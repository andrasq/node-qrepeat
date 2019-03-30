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
qrepeat.repeatUntil = function(fn, cb) { untilSingleton._repeat(fn, cb) };
// FIXME: repeatUntilA ??
// qrepeat.repeatUntilA = function(fn, arg, testStop, cb) { new QRepeat().repeatUntil(fn, arg, testStop, cb) };
qrepeat.doUntil = qrepeat.repeatUntil;
qrepeat.repeatWhile = function(ck, fn, cb) { new QRepeatWhile(ck)._repeat(fn, cb) };
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

/*
 * the repeater class constructor
 */
function QRepeat( ) {
}

// repeat loop() until it returns error or truthy
// Arguments may be passed by redefining _tryCall, _testStop and _tryCallback.
QRepeat.prototype.__repeat = function _repeat( loop, callback ) {
    var self = this;
    var depth = 0, tickBreaks = 0, callCount = 0, returnCount = 0;

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
        else if (self._testStop(err, stop)) { return self._tryCallback(callback, err) }
        else if (depth++ < 20) { callCount++; return self._tryCall(loop, _return) }
        else {
            // every 20 calls break up the call stack, every 100 yield to the event loop
            depth = 0; callCount++;var fn = function(){ self._tryCall(loop, _return) }
            if (++tickBreaks < 100) { nextTick(fn) } else { tickBreaks = 0; setImmediate(fn) }
        }
    }
}

QRepeat.prototype._repeat = cloneFunc(QRepeat.prototype.__repeat);
QRepeat.prototype.repeatUntil = function repeatUntil( loopFunc, callback ) {
    // works with all defaults
    this._repeatRU(loopFunc, callback);
};
QRepeat.prototype._tryCall1 = function _tryCall1(func, cb) {
    try { func(cb) } catch (err) { cb(makeError('THREW', err || 'threw falsy error')) } };
QRepeat.prototype._tryCallback1 = function _tryCallback1(cb, err) {
    try { cb(err) } catch (err2) { warn(qrepeat.cbThrewWarning, err2, err2.stack); throw err2 } }
QRepeat.prototype._cleanCallback = function _cleanCallback( err, state ) {
    err === state ? state.cb() : state.cb(err) }
QRepeat.prototype._testStop = function _testRepeatUntilDone(err, done) {
    return err || done; }
QRepeat.prototype._tryCall = QRepeat.prototype._tryCall1;
QRepeat.prototype._tryCallback = QRepeat.prototype._tryCallback1;

/**
QRepeat.prototype._repeatRW = cloneFunc(QRepeat.prototype.__repeat);
QRepeat.prototype.repeatWhile = function repeatWhile( testFunc, loopFunc, callback ) {
    // this function must be called on a new object every time
    //var state = { test: testFunc, loop: loopFunc, cb: callback };
    this._preTest = testFunc;
    this._tryCall = this._tryCallWhile;
    this._testStop = this._testStopMarker;
    this._repeatRW(loopFunc, callback);
}
QRepeat.prototype._postTest = function(){};
QRepeat.prototype._preTest = function(){};
QRepeat.prototype._tryCallWhile = function _tryCallWhile( func, cb ) {
    this._preTest() ? this._tryCall1(func, cb) : cb(null, 'qrepeat-done-marker') }
QRepeat.prototype._testStopMarker = function(err, done) { return err || done === 'qrepeat-done-marker' }

QRepeat.prototype._tryCall1 = function _tryCall1(func, cb) {
    try { func(cb) } catch (err) { cb(makeError('THREW', err || 'threw falsy error')) } };
QRepeat.prototype._tryCallback1 = function _tryCallback1(cb, err) {
    try { cb(err) } catch (err2) { warn(qrepeat.cbThrewWarning, err2, err2.stack); throw err2 } }
QRepeat.prototype._cleanCallback = function _cleanCallback( err, state ) {
    err === state ? state.cb() : state.cb(err) }
QRepeat.prototype._testRepeatUntilDone = function _testRepeatUntilDone(err, done) {
    return err || done; }
QRepeat.prototype._testStop = QRepeat.prototype._testRepeatUntilDone;
**/


function QRepeatWhile( testFunc ) {
    this._preTest = testFunc;
}
util.inherits(QRepeatWhile, QRepeat);
QRepeatWhile.prototype._preTest = function(){};
QRepeatWhile.prototype._repeat = cloneFunc(QRepeat.prototype.__repeat);
QRepeatWhile.prototype._tryCall = function _tryCallWhile( func, cb ) {
    this._preTest() ? this._tryCall1(func, cb) : cb(null, 'qrepeat-done-marker') };
QRepeatWhile.prototype._testStop = function(err, done) {
    return err || done === 'qrepeat-done-marker' }
QRepeatWhile.prototype.repeatWhile = function( testFunc, loopFunc, callback ) {
    // this function must be called on a new object every time
    this._preTest = testFunc;
    this._repeat(loopFunc, callback);
}

QRepeat.prototype = toStruct(QRepeat.prototype);
function toStruct(obj) { return eval("toStruct.prototype = obj") }
function cloneFunc(fn) { return eval("true && " + fn.toString()) }

