// Core modules
var fs = require('fs');
var os = require('os');
var util = require('util');
var child_process = require('child_process');
var EventEmitter = require('events').EventEmitter;

// Userland modules
var extend = require('node.extend');


var defaultConfig = {

  // The initial number of concurrent Workers.
  // This initial pool of Workers will not honor the `stagger`, if any.
  // Default: `0`
  initialWorkers: 0,

  // The maximum number of concurrent Workers.
  // Default: `require('os').cpus().length` (1 per CPU)
  maxWorkers: os.cpus().length,

  // Should the initial creation of workers be staggered?
  // Default: `false`.
  stagger: false,

  // The number of milliseconds to use as a staggered start time for workers.
  // Only relevant if `stagger` is set to `true`.
  // Default: `5000` (5 seconds).
  staggeredStart: 5000,

  // When one worker finishes, should a new worker "take the next shift"?
  // Note that if `stagger` is set to `true`, reinforcements will continue to
  // honor the `staggeredStart` delay.
  // Default: `true`.
  continuous: true,

  // The number of milliseconds to use as the maximum allowed run time for a
  // single execution of the `task`. When the limit is reached, the worker will
  // be forcibly killed if the `task` has not been completed.
  // Default: `null` (infinite time)
  maxWorkerTime: null,

  // The number of milliseconds to use as the maximum allowed run time for the
  // entire process. If you have reinforceing workers, they will continue to work
  // until this limit is reached, and then the "Legion" will kill all of its
  // subordinates.
  // Default: `null` (infinite time)
  maxTime: null,

  // The actual work to do. This MUST be set to an existing file path.
  // Default: `null`.
  taskScript: null,

  // Suppress all stdio from child processes
  // Default: `true`.
  silent: true

};


//
// TO ARMS!!!
//
function Legion(options) {
  // Ensure that `this` becomes an instance of `Legion`
  if (!(this instanceof Legion)) {
    return new Legion(options);
  }

  // If no work was assigned, bail out (unless `taskScript` was not specified at all)
  if (options && options.hasOwnProperty('taskScript') && typeof options.taskScript !== 'string') {
    throw new TypeError('No `taskScript` was assigned!');
  }

  // Merge any user-overridden configuration
  this._privateData = {
    startTime: null,      // The timestamp from when `start` was invoked
    maxTimeoutId: null,   // The ID of the timeout that manages the total duration
    theExitCode: null,    // Keep track of if the process is already exiting
    alreadyDead: null,    // Keep track of if the process is already been deemed dead
    workers: {},          // Keep track of the workers
    workerStartTimes: {}, // Timestamps of start for each worker (informational only)
    workerTimeoutIds: {}, // Keep track of worker duration timeouts
    config: extend({}, defaultConfig, options)
  };


  // Listen for terminal signal events and then force-exit the process
  var boundExit = function() {
    process.exit(1);
  };
  process.on('SIGTERM', boundExit);
  process.on('SIGINT', boundExit);
  process.on('SIGHUP', boundExit);

  // If the Node process is exiting...
  process.on('exit', function(exitCode) {
    if (!this._privateData.alreadyDead) {
      this._privateData.theExitCode = exitCode;
      this.exit(exitCode);
    }
  }.bind(this));

  process.on('uncaughtException', function(err) {
    this.emit('error', err);
    this.exit(1);
  }.bind(this));
};
util.inherits(Legion, EventEmitter);


//
// All is lost!
//
Legion.prototype.exit = function(exitCode) {
  // Die, workers! Die!
  for (var workerId in this._privateData.workers) {
    this._privateData.workers[workerId].kill('SIGINT');
  }

  return die.call(this, exitCode);
};


//
// TO WAR!!!
//
Legion.prototype.run = function(instructions) {
  if (this._privateData.startTime) {
    throw new Error('Do not call `run` more than once!');
  }

  // Mark the time
  this._privateData.startTime = Date.now();

  // Local reference
  var config = this._privateData.config;

  // If no task was assigned, bail out
  if (typeof config.taskScript !== 'string') {
    throw new TypeError('No `taskScript` was assigned!');
  }

  var taskStats = fs.existsSync(config.taskScript) === true ? fs.statSync(config.taskScript) : null;
  if (!(taskStats && taskStats.isFile())) {
    throw new TypeError('The assigned `taskScript` file does not exist');
  }

  // Build your legion!
  this.emit('start', {
    type: 'start',
    role: 'legion',
    id: process.pid,
    owner: null,
    data: null
  });

  // Keep the configuration clean
  if (typeof config.initialWorkers !== 'number' || isNaN(config.initialWorkers) || config.initialWorkers < 0) {
    config.initialWorkers = 0;
  }
  if (typeof config.maxWorkers !== 'number' || isNaN(config.maxWorkers) || config.maxWorkers < 0) {
    throw new TypeError('The assigned `maxWorkers` value is not positive integer!');
  }

  // Prepare to create Workers...
  var doNotStagger = !(config.stagger === true && typeof config.staggeredStart === 'number' && config.staggeredStart >= 0);
  var createWorkerFn = createWorker.bind(this, instructions);

  // Create initial Workers
  var i, len;
  for (i = 0, len = config.initialWorkers; i < len; i++) {
    createWorkerFn();
  }

  // Create more Workers!
  var remainingWorkers = config.maxWorkers - config.initialWorkers,
      waitTime = config.initialWorkers > 0 ? config.staggeredStart : 0;
  if (remainingWorkers > 0) {
    for (i = 0; i < remainingWorkers; i++) {
      if (doNotStagger) {
        createWorkerFn();
      }
      else {
        waitTime += config.staggeredStart;
        setTimeout(createWorkerFn, waitTime);
      }
    }
  }

  // Only allow this process chain to run for a max of `maxTime` milliseconds
  if (typeof config.maxTime === 'number' && config.maxTime > 0) {
    this._privateData.maxTimeoutId = setTimeout(this.exit.bind(this), config.maxTime);
  }

  return this;
};


function createWorker(instructions) {

  // Prepare to create Workers...
  var config = this._privateData.config;
  var doNotStagger = !(config.stagger === true && typeof config.staggeredStart === 'number' && config.staggeredStart >= 0);
  var createWorkerFn = createWorker.bind(this);

  // Mark the time
  var workerStartTime = Date.now();

  // Fork the child_process
  var worker = child_process.fork(
    require.resolve('./worker'),
    [config.taskScript],
    { silent: config.silent === true }
  );

  var workerPid = worker.pid;

  // When a Worker is terminated...
  var destroyWorkerFn = destroyWorker.bind(this, worker);
  worker.on('exit', function() {
    console.log('Worker is about to self-destruct...')
    destroyWorkerFn.apply(this, Array.prototype.slice.call(arguments, 0).concat([instructions]));
  }.bind(this));

  // When a Worker makes a mistake...
  worker.on('error', function(err) {
    console.error('Worker ERROR!');
    console.dir(err);
  });

  // Sir, I beseech you: listen to the workers!
  worker.on('message', function(msg) {
    if (msg && msg.type && msg.role === 'worker') {
      this.emit(msg.type, msg);
    }
  }.bind(this));


  // Store the marked time
  this._privateData.workerStartTimes[workerPid] = workerStartTime;

  // Store a timer, if required
  if (typeof config.maxWorkerTime === 'number' && config.maxWorkerTime > 0) {
    this._privateData.workerTimeoutIds[workerPid] = setTimeout(worker.kill.bind(worker, 'SIGINT'), config.maxWorkerTime);
  }
  
  // Store the child_process reference
  this._privateData.workers[workerPid] = worker;

  // Record the worker's employment
  this.emit('start', {
    type: 'start',
    role: 'worker',
    id: workerPid,
    owner: process.pid,
    data: null
  });

  // Tell the Worker to get to work [if it hasn't already]!
  worker.send({
    type: 'start',
    role: 'worker',
    id: workerPid,
    owner: process.pid,
    data: instructions
  });

  return this;
}


function destroyWorker(worker, exitCode, signal, instructions) {
  exitCode = typeof exitCode === 'number' ? exitCode : signal ? 128: 0;

  var config = this._privateData.config;
  var workerPid = worker.pid;

  // Sound the death knell
  this.emit('end', {
    type: 'end',
    role: 'worker',
    id: workerPid,
    owner: process.pid,
    data: {
      reason: exitCode !== 0 ? 'fired' : 'quit',
      exitCode: exitCode,
      duration: Date.now() - this._privateData.workerStartTimes[workerPid]
    }
  });

  // See if there are other workers remaining
  var hasWorkersLeft = false;
  for (var workerId in this._privateData.workers) {
    if (this._privateData.workers[workerId].pid !== workerPid) {
      hasWorkersLeft = true;
      break;
    }
  }


  // Clear any remaining timeouts
  var workerTimeoutId = this._privateData.workerTimeoutIds[workerPid];
  if (workerTimeoutId) {
    clearTimeout(workerTimeoutId);
    workerTimeoutId = null;
  }

  // Clean up storage
  delete this._privateData.workerStartTimes[workerPid];
  delete this._privateData.workerTimeoutIds[workerPid];
  delete this._privateData.workers[workerPid];

  // Reinforcements!!! Rise from the ashes!
  // Create another Worker process when one Worker exits.
  if (config.continuous === true) {
    var createWorkerFn = createWorker.bind(this, instructions);
    if (config.stagger === true && typeof config.staggeredStart === 'number' && config.staggeredStart >= 0) {
      setTimeout(createWorkerFn, config.staggeredStart);
    }
    else {
      process.nextTick(createWorkerFn);
    }
  }
  // Legion itself should bail out if no workers remain
  else if (!hasWorkersLeft) {
    die.call(this, exitCode);
  }
}


//
// Whether natural or at the hand of our enemy, we all eventually meet our end.
//
function die(exitCode) {
  var theExitCode = this._privateData.theExitCode;
  var wasExitingAlready = typeof theExitCode !== 'number';
  var finalExitCode = wasExitingAlready ? theExitCode : typeof exitCode === 'number' ? exitCode : 0;

  // Sound the death knell
  this.emit('end', {
    type: 'end',
    role: 'legion',
    id: process.pid,
    owner: null,
    data: {
      reason: finalExitCode !== 0 ? 'fired' : 'quit',
      exitCode: finalExitCode,
      duration: Date.now() - this._privateData.startTime
    }
  });

  // Clear any timeouts
  var maxTimeoutId = this._privateData.maxTimeoutId;
  if (maxTimeoutId) {
    clearTimeout(maxTimeoutId);
    maxTimeoutId = null;
  }
  delete this._privateData.maxTimeoutId;
  
  // Clean up
  this._privateData.startTime = null;
  this._privateData.theExitCode = null;
  this._privateData.alreadyDead = true;

  // Exit forcibly but only if someone else didn't already invoke the exit
  if (!wasExitingAlready) {
    process.exit(finalExitCode);
  }

  return this;
};


// Export API
module.exports = Legion;
