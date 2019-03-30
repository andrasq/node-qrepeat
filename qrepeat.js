/**
 * very fast repeatUntil
 * Adapted from microrest, which adapted it from aflow, originally called repeatUntil.
 *
 * Copyright (C) 2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2019-01-25 - AR.
 */

'use strict';

var util = require('util');

var untilSingleton = new QRepeat();

var qrepeat = module.exports = {};
qrepeat.QRepeat = QRepeat;
qrepeat.repeatUntil = function(fn, cb) { untilSingleton.repeatUntil(fn, cb) };
qrepeat.repeatUntilA = function(fn, arg, testStop, cb) { new QRepeat().repeatUntil(fn, arg, testStop, cb) };
qrepeat.doUntil = qrepeat.repeatUntil;
qrepeat.repeatWhile = function(ck, fn, cb) { new QRepeat().repeatWhile(ck, fn, cb) };
qrepeat.cbAlreadyCalledWarning = 'qrepeat: callback already called';
qrepeat.cbThrewWarning = 'qrepeat: callback threw';
toStruct(qrepeat);

// node-v0.10 nextTick did not accept function args yet
var nodeVersion = parseFloat(process.versions.node);
var nextTick = nodeVersion >= 4 ? process.nextTick : setImmediate;

// TODO: move into the class, add mechanism for turning off warnings 
// print a warning to stderr
function warn( ) {
    console.warn("%s -- qrepeat: %s", new Date().toISOString(), util.format.apply(util, [].slice.call(arguments)));
}

function makeError( code, message ) {
    var err = (typeof message === 'object') ? err : (err = new Error(message), err.code = code, err);
    err.qrcode = code;
    Error.captureStackTrace(err, makeError);
    return err;
}

function QRepeat( ) {
}

QRepeat.prototype._repeat = function _repeat( loop, arg, callback ) {
    var self = this;
    self.arg = arg;
    var depth = 0, tickBreaks = 0, callCount = 0, returnCount = 0;
    // self._testStop must have been set before calling

    callCount++; self._tryCall(loop, _return);

    function _return(err, stop) {
        // TODO: maybe _tryCallback should suppress duplicate callbacks to the caller
        // NOTE: counting callbacks is not fool proof:
        //   - a duplicate callback before current call returns will be used instead
        //   - a duplicate callback could be used instead of a missing callback
        if (++returnCount > callCount) {
            // warn in addition to invoking callback with an error
            var msg = qrepeat.cbAlreadyCalledWarning + (err ? '; new error: ' + err.stack : '');
            warn(msg); self._tryCallback(callback, makeError('DUPCB', msg));
        }
        else if (self._testStop(err, stop, arg)) { return self._tryCallback(callback, err) }
        else if (depth++ < 20) { callCount++; return self._tryCall(loop, _return) }
        else {
            // every 20 calls break up the call stack, every 100 yield to the event loop
            depth = 0; callCount++;var fn = function(){ self._tryCall(loop, _return) }
            if (++tickBreaks < 100) { nextTick(fn) } else { tickBreaks = 0; setImmediate(fn) }
        }
    }
}

QRepeat.prototype._repeatRU = cloneFunc(QRepeat.prototype._repeat);
QRepeat.prototype.repeatUntil = function repeatUntil( loopFunc, callback ) {
    this._testStop = this._testRepeatUntilDone;
    this._repeatRU(loopFunc, 0, callback);
};
// using our own copy of _repeat raises the deoptimized throughput from 34 to 37m/s (or 37 to 48m/s reusing the test func)
QRepeat.prototype._repeatRW = cloneFunc(QRepeat.prototype._repeat);
QRepeat.prototype.repeatWhile = function repeatWhile( testFunc, loopFunc, callback ) {
    // this function must be called on a new object every time
    var state = { test: testFunc, loop: loopFunc, cb: callback };
//    this._tryCall = this._tryCall2;
//    this._tryCallback = this._tryCallback2;
//    this._testStop = this._whileTestDone;
    this._testStop = this._noop;
    this._testWhile = testFunc;
    this._tryCall = this._tryCallWhile;
    this._repeatRW(this._whileLooper, state, this._cleanCallback);
}
QRepeat.prototype.repeatWhile = function repeatWhile( testFunc, loopFunc, callback ) {
    // this function must be called on a new object every time
    var state = { test: testFunc, loop: loopFunc, cb: callback };
    this._tryCall = this._tryCall2;
    this._tryCallback = this._tryCallback2;
    this._testStop = this._whileTestDone;
    this._repeatRW(this._whileLooper, state, this._cleanCallback);
}
QRepeat.prototype._whileLooper = function _whileLooper( done, state ) { state.test() ? state.loop(done) : done(state, true) }
QRepeat.prototype._whileTestDone = function _whileTestDone( err, done, state ) { return err === state ? done : err }    // only believe `done` if err==state from _whileLooper
QRepeat.prototype._noop = function(){};
QRepeat.prototype._testWhile = function(){};
QRepeat.prototype._tryCallWhile = function _tryCallWhile( func, cb ) {
    if (this._testWhile()) this._tryCall1(func, cb);
    else cb(null, true);
}

QRepeat.prototype._tryCall1 = function _tryCall1(func, cb) {
    try { func(cb) } catch (err) { cb(err || makeError('THREW', 'threw falsy error')) } };
QRepeat.prototype._tryCall2 = function _tryCall2(func, cb) {
    try { func(cb, this.arg) } catch (err) { cb(err || makeError('THREW', 'threw falsy error'), this.arg) } };
QRepeat.prototype._tryCallback1 = function _tryCallback1(cb, err) {
    try { cb(err) } catch (err2) { warn(qrepeat.cbThrewWarning, err2, err2.stack); throw err2 } }
QRepeat.prototype._tryCallback2 = function _tryCallback2(cb, err) {
    try { cb(err, this.arg) } catch (err2) { warn(qrepeat.cbThrewWarning, err2); throw err2 } }
QRepeat.prototype._cleanCallback = function _cleanCallback( err, state ) {
    err === state ? state.cb() : state.cb(err) }
QRepeat.prototype._testRepeatUntilDone = function _testRepeatUntilDone(err, done) {
    return err || done; }
QRepeat.prototype._testStop = QRepeat.prototype._testRepeatUntilDone;
QRepeat.prototype._stopFlag = false;
QRepeat.prototype._testStopFlag = function() { return this._stopFlag };
QRepeat.prototype._noop = function(){};

QRepeat.prototype._tryCall = QRepeat.prototype._tryCall1;
QRepeat.prototype._tryCallback = QRepeat.prototype._tryCallback1;

QRepeat.prototype = toStruct(QRepeat.prototype);
function toStruct(obj) { return eval("toStruct.prototype = obj") }
function cloneFunc(fn) { return eval("true && " + fn.toString()) }

