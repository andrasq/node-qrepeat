// npm install qtimeit async aflow

var qrepeat = require('./');
var QRepeat = qrepeat.QRepeat;
var repeatUntil = qrepeat.repeatUntil;
var repeatWhile = qrepeat.repeatWhile;

var qtimeit = require('../qtimeit');
var aflow = require('aflow');
var async = require('async');

// 77m/s len 100k (node-v8; 78m/s node-v10)
// 108m/s len 100k node-v8
function repeatUntil2( loop, done ) {
    var depth = 0;
    var returned = 0;

    function _return(err, stop){
        if (err || stop) { if (returned) _callbackAlreadyCalled(err); returned = true; return done(err, stop); }
        // TODO: else if () if ((err = _tryFunc(loop, _return))) _callbackAlreadyCalled(null, err);
        else if (depth++ < 40) _tryFunc(loop, _return);
        //else { depth = 0; setImmediate(_tryFunc, loop, _return); }
        else { depth = 0; nextTick(_tryFunc, loop, _return); }
    }

    _tryFunc(loop, _return);
}
function _tryFunc( loopFn, cb ) { try { loopFn(cb) } catch (err) { cb(err); return err || new Error('threw falsy error') } }
function _callbackAlreadyCalled( err, exc ) {
    if (exc) console.log("error thrown after callback called: ", err);
    else console.log("callback already called: ", new Error().stack);
}

// TODO: maybe support an offset?
function _gatherArgv( handler ) {
    return function(/* VARARGS */) {
        var argv = new Array(arguments.length);
        for (var i=offset; i<argv.length; i++) argv[i] = arguments[i];
        handler(argv);
    }
}

function _vinvoke(cb, av) {
    return _vinvoke2(cb, null, av);
}

function _vinvoke2(cb, self, av) {
    switch (av.length) {
    case 0: return cb();
    case 1: return cb(av[0]);
    case 2: return cb(av[0], av[1]);
    case 3: return cb(av[0], av[1], av[2]);
    default: cb.apply(self, av);
    }
}

function _callbackCaller( cb, limit ) {
    var ncalls = 0;
    limit = limit || 20;
// TODO: async.whilst dies with no message if callback is called from nextTick ??
limit = 1;
/**
    return _gatherArgv(function(av) {
        if (++ncalls <= limit) return _vinvoke(cb, av);
        else { ncalls = 0; nextTick(_vinvoke, cb, av) }
    })
**/
    return function(a, b) {
//console.log("AR: cb called", a, b, cb);
if (++ncalls <= limit) return cb(a, b);
ncalls = 0; setImmediate(cb, a, b);
return;

//console.log("AR: done")
return nextTick(_vinvoke, cb, [a, b]);
return nextTick(cb, a, b);
        if (++ncalls <= limit) cb(a, b);
        else { ncalls = 0; nextTick(cb, a, b) }
    }
}

var nloops = 4;
var n = 0;
var testNFunc = function() { return n < nloops };
var testNFunc2 = function() { return n < nloops };
var testNNFunc = function() { return !testNFunc() }
var testNNFunc2 = function() { return !testNFunc() }
function loopFunc( done ) { try { done(null, ++n >= nloops) } catch(e){} }
function loopFunc2( done ) { try { done(null, ++n >= nloops) } catch(e){} }
var qr = QRepeat();
var bench = {
    // note: repeatWhile needs a separate bound testFunc for each call
    //'async.whilst': function(cb) { n = 0; async.whilst(testNFunc, loopFunc, function(){ nextTick(cb) }) },
    //'async.whilst_b': function(cb) { n = 0; async.whilst(testNFunc2, loopFunc2, function(){ nextTick(cb) }) },
// /**
    // note: async@2,@2 work, async@3 causes node to exit immediately
    // note: async@2 pulls in lodash as a dependency, size v1 184K -> v2 5800K -> v3 996K
    'async.whilst': function(cb) { n = 0; async.whilst(testNFunc, loopFunc, _callbackCaller(cb)) },
    'async.whilst_b': function(cb) { n = 0; async.whilst(testNFunc2, loopFunc2, _callbackCaller(cb)) },
    'async.doUntil': function(cb) { n = 0; async.doUntil(loopFunc, testNNFunc, _callbackCaller(cb)) },
    'async.doUntil_b': function(cb) { n = 0; async.doUntil(loopFunc2, testNNFunc2, _callbackCaller(cb)) },
/**/
    'qrepeat.repeatUntil': function(cb) { n = 0; qrepeat.repeatUntil(loopFunc, cb) },
    'qrepeat.repeatUntil_b': function(cb) { n = 0; qrepeat.repeatUntil(loopFunc2, cb) },
    'qrepeat.repeatWhile': function(cb) { n = 0; qrepeat.repeatWhile(testNFunc, loopFunc, cb) },
    'qrepeat.repeatWhile_b': function(cb) { n = 0; qrepeat.repeatWhile(testNFunc2, loopFunc2, cb) },
    'aflow.repeatUntil': function(cb) { n = 0; aflow.repeatUntil(loopFunc, cb) },
    'aflow.repeatUntil_b': function(cb) { n = 0; aflow.repeatUntil(loopFunc2, cb) },
    'aflow.repeatWhile': function(cb) { n = 0; aflow.repeatWhile(testNFunc, loopFunc, cb) },
    'aflow.repeatWhile_b': function(cb) { n = 0; aflow.repeatWhile(testNFunc2, loopFunc2, cb) },
};

var tests = Object.keys(bench);
//for (var i=0, k; (k=tests[i], i<tests.length); i++) bench[k + ' 2'] = bench[k];
//for (var i=0, k; (k=tests[i], i<tests.length); i++) bench[k + ' 3'] = bench[k];

qtimeit.bench.timeGoal = .22;
//qtimeit.bench.forkTests = true;
qtimeit.bench.visualize = true;
//qtimeit.bench.showRunDetails = false;
qtimeit.bench.opsPerTest = nloops;
var nruns = 0;
qrepeat.repeatUntil(function(done) {
    if (nruns++ >= 3) return done(null, true);
    console.time("test");
    repeatUntil2(function(next) {
        var x = 0;
        console.log("repeatUntil (5):");
        qrepeat.repeatUntil(function(cb) { console.log(++x); cb(null, x >= 5) }, function(){ next(null, true) });
    }, function(err) {
        if (err) console.log("AR: repeatUntil error:", err.stack);
        repeatUntil2(function(next) {
            var x = 0;
            console.log("repeatWhile (3):");
            qrepeat.repeatWhile(function() { return x++ < 3 }, function(cb) { console.log(x); cb() }, function(){ next(null, true) });
        }, function(err) {
            if (err) console.log("AR: repeatWhile error:", err.stack);
            qtimeit.bench(bench, function(err) {
                if (err) console.log("AR: bench error:", err.stack);
                console.timeEnd("test");
                done();
            })
        })
    })
}, function(err) {
    console.log("AR: Done.");
})

process.on('uncaughtException', function(err) {
    console.log("AR: uncaught exception", err.stack);
})
