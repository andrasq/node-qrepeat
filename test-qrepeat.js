/**
 * Copyright (C) 2019 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var qrepeat = require('./');

module.exports = {
    'should export expected functions': function(t) {
        t.equal(typeof qrepeat.repeatUntil, 'function');
        t.equal(typeof qrepeat.repeatWhile, 'function');
        t.done();
    },

    'repeatUntil': {
        'should repeat at least 1 time': function(t) {
            var n = 0;
            qrepeat.repeatUntil(function(cb) { cb(null, ++n >= 0) }, function(err) {
                t.equal(n, 1);
                t.done(err);
            })
        },

        'should repeat 1 times time': function(t) {
            var n = 0;
            qrepeat.repeatUntil(function(cb) { cb(null, ++n >= 1) }, function(err) {
                t.equal(n, 1);
                t.done(err);
            })
        },

        'should repeat 1000000 times': function(t) {
            var n = 0;
            qrepeat.repeatUntil(function(cb) { cb(null, ++n >= 1e6) }, function(err) {
                t.equal(n, 1e6);
                t.done(err);
            })
        },

        'errors': {
            'should break on and return errors': function(t) {
                var n = 0, error = new Error('test error');
                qrepeat.repeatUntil(function(cb) {
                    n += 1;
                    cb(n === 3 && error, false);
                }, function(err) {
                    t.equal(n, 3);
                    t.equal(err, error);
                    t.done();
                })
            },

            'should catch and return errors': function(t) {
                qrepeat.repeatUntil(function() { throw false }, function(err) {
                    t.ok(err);
                    t.equal(err.qrcode, 'THREW');
                    t.contains(err.message, 'threw falsy');
                    t.done();
                })
            },

            'should warn about and return callback errors': function(t) {
                var spy = t.stub(process.stderr, 'write');
                var returnCount = 0;
                qrepeat.repeatUntil(function(cb) { cb(null, true) }, function(err) {
                    if (!returnCount++) {
                        t.ok(!err);
                        throw new Error('mock callback error');
                    }
                    if (returnCount == 2) {
                        spy.restore();
                        t.ok(err);
                        t.equal(err.qrcode, 'DUPCB');
                        t.contains(spy.args[0][0], 'qrepeat: callback threw');
                        t.ok(spy.called);
                        t.contains(spy.args[0][0], 'mock callback error');
                        t.contains(spy.args[1][0], 'qrepeat: callback already called');
                        t.done();
                    }
                });
            },

            'should print warning and return error on duplicate callback': function(t) {
                var n = 0, rets = [];
                var stub = t.stub(process.stderr, 'write');
                qrepeat.repeatUntil(function(cb) {
                    n += 1;
                    setImmediate(cb, null, n >= 10);
                    if (n == 3) setTimeout(cb, 2);
                    if (n == 7) setTimeout(cb, 2, new Error('test error'));
                }, function(err) {
                    rets.push(err);
                    if (rets.length === 3) {
                        stub.restore();
                        t.equal(rets.length, 3);
                        t.ok(rets[0] == null);
                        t.ok(rets[1] instanceof Error);
                        t.ok(rets[2] instanceof Error);
                        t.equal(stub.args.length, 2);
                        t.contains(stub.args[0][0], /callback already called/);
                        t.contains(stub.args[1][0], /callback already called/);
                        // returns a new error on duplicate callback
                        t.contains(rets[1].message, /already called/);
                        // but returns the actual error if callback had error
                        t.contains(rets[2].message, /test error/);
                        t.done();
                    }
                })
            },

            'should print warning and rethrow if user callback throws': function(t) {
                var stub = t.stub(process.stderr, 'write');
                var listeners = process.listeners('uncaughtException');
                // suppress global error handlers to not kill this test
                for (var i=0; i<listeners.length; i++) process.removeListener('uncaughtException', listeners[i]);
                process.once('uncaughtException', function errListener(err2) {
                    t.equal(err2.message, 'test error');
                    for (var i=0; i<listeners.length; i++) process.on('uncaughtException', listeners[i]);
                    t.done();
                })
                qrepeat.repeatUntil(function(cb) { return cb(null, true) }, function(err) {
                    setTimeout(function() { throw new Error('test error') }, 10);
                })
            },
        },
    },

    'repeatWhile': {
        'should repeat 0 times': function(t) {
            var n = 0;
            qrepeat.repeatWhile(function() { return false }, function(cb) { n++; cb() }, function(err) {
                t.equal(n, 0);
                t.done();
            })
        },

        'should repeat 1 times': function(t) {
            var n = 0;
            qrepeat.repeatWhile(function() { return n < 1 }, function(cb) { n++; cb() }, function(err) {
                t.equal(n, 1);
                t.done();
            })
        },

        'should repeat 1000000 times': function(t) {
            var n = 0;
            qrepeat.repeatWhile(function() { return n < 1e6 }, function(cb) { n++; cb() }, function(err) {
                t.equal(n, 1e6);
                t.done();
            })
        },

        'errors': {
        },
    },
}
