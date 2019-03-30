qrepeat
=======
[![Build Status](https://api.travis-ci.org/andrasq/node-qrepeat.svg?branch=master)](https://travis-ci.org/andrasq/node-qrepeat?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/andrasq/node-qrepeat/badge.svg?branch=master)](https://coveralls.io/github/andrasq/node-qrepeat?branch=master)

Fast iteration of async functions.

    const qrepeat = require('qrepeat');

    function repeatThreeTimes( func ) {
        var count = 0;
        qrepeat.repeatUntil(
            function(next) {
                console.log(++count);
                next(null, count >= 3);
            },
            function(err) {
            }
        );
    }
    repeatThreeTimes();
    // => 1
    //    2
    //    3


Testing
-------

Qrepeat tries to keep the call overhead low, to be efficient for even short loops.  Tests
and benchmark in the repo.

    qtimeit=0.22.0 node=11.8.0 v8=7.0.276.38-node.16 platform=linux kernel=4.9.0-0.bpo.4-amd64 up_threshold=false
    arch=ia32 mhz=4186 cpuCount=8 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz"
    name                          speed           rate
    async.whilst             13,162,223 ops/sec   1000 >>>>>
    async.doUntil             9,749,568 ops/sec    741 >>>>
    qrepeat.repeatUntil      60,278,971 ops/sec   4580 >>>>>>>>>>>>>>>>>>>>>>>
    qrepeat.repeatWhile      37,007,516 ops/sec   2812 >>>>>>>>>>>>>>
    aflow.repeatUntil        49,575,938 ops/sec   3767 >>>>>>>>>>>>>>>>>>>
    aflow.repeatWhile        18,314,612 ops/sec   1391 >>>>>>>


API
---

### repeatUntil( fn, callback(err) )

Repeatedly call `fn(cb)` until it returns a truthy value to its callback.  Stops if `fn` throws.
Note: because `callback` runs in the same try/catch as `fn`, errors thrown by `callback` are
also caught and routed to the callback.

### repeatWhile( testFn, fn, callback(err) )

While `testFn()` return truthy, repeatedly call `fn(cb)`.  Stops if fn throws.
Note: because `callback` runs in the same try/catch as `fn`, errors thrown by `callback` are
also caught and routed to the callback.
