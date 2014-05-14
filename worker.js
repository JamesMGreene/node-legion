// Core modules
var fs = require('fs');
var path = require('path');
var requireModify = require('require-modify');


// Grab the "taskScript" path from the command line arguments
var _taskScript = process.argv[process.argv.length - 1];
var _taskScriptPath = require.resolve(_taskScript);


// Load and modify the "taskScript"-configured module
requireModify(_taskScriptPath, function(source) {
  return '(' + modifyProcessFn + ')();\n' + source;
});


function modifyProcessFn() {
  //
  // If in a child process [as expected] and we have a valid `taskScript`...
  //
  if (typeof process.send === 'function') {

    // Keep track of the owner process
    var _owner = null;


    // Store a reference to the original `emit` function
    var _emit = process.emit;


    //
    // If the Legion tells you that you're hired, get to work!
    //
    process.on('message', function starter(msg) {
      if (msg && msg.type === 'start' && msg.role === 'worker') {
        _owner = msg.owner || null;
        var instructions = (msg && msg.data) || undefined;

        // Schedule the emission
        process.nextTick(function() {
          _emit.call(process, 'start', instructions);
        });

        // Remove this listener, it has served its purpose
        process.removeListener('message', starter);
      }
    });


    //
    // Listen for terminal signal events and then force-exit the process
    //
    var boundExit = function() {
      process.exit(1);
    };
    var boundExit = function(signal) {
      process.emit('log', { source: 'process', data: ['Worker received terminal signal "' + signal + '"'] });
      process.exit(1);
    };
    process.on('SIGTERM', boundExit.bind(process, 'SIGTERM'));
    process.on('SIGINT', boundExit.bind(process, 'SIGINT'));
    process.on('SIGHUP', boundExit.bind(process, 'SIGHUP'));


    //
    // Forward a copy of all emissions to the listening parent process
    //
    process.emit = function(eventName) {
      // Send the emission to the parent process
      if (typeof eventName === 'string' && eventName && eventName !== 'newListener' && eventName !== 'removeListener') {
        var eventData = Array.prototype.slice.call(arguments, 1);
        process.send({
          type: eventName,
          role: 'worker',
          id: process.pid,
          owner: _owner,
          data: eventData
        });
      }

      // Invoke the regular `emit` method, too
      return _emit.apply(process, arguments);
    };
  }
}
