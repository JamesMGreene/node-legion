// Core modules
var os = require('os');
var cluster = require('cluster');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

// Userland modules
var extend = require('node.extend');


var defaultConfig = {

  // The number of centuries.
  // Default: `require('os').cpus().length` (1 per CPU)
  maxCenturies: os.cpus().length,

  // The maximum number of concurrent soldiers per century.
  // Default: `8`.
  maxSoldiersPerCentury: 8,

  // Should the initial creation of soldiers be staggered?
  // Default: `false`.
  stagger: false,

  // The number of milliseconds to use as a staggered start time for soldiers.
  // Only relevant if `stagger` is set to `true`.
  // Default: `5000` (5 seconds).
  staggeredStart: 5000,

  // When one soldier finishes, should a new soldier "take the next shift"?
  // Note that if `stagger` is set to `true`, reinforcements will continue to
  // honor the `staggeredStart` delay.
  // Default: `true`.
  reinforce: true,

  // The number of milliseconds to use as the maximum allowed run time for a
  // single execution of the `mission`. When the limit is reached, the soldier will
  // be forcibly killed if the `mission` has not been completed.
  // Default: `null` (infinite time)
  maxActiveDutyPerMission: null,

  // The number of milliseconds to use as the maximum allowed run time for the
  // entire process. If you have reinforceing soldiers, they will continue to work
  // until this limit is reached, and then the "Legion" will kill all of its
  // subordinates.
  // Default: `null` (infinite time)
  maxCommission: null,

  // The actual work to do. This MUST be set to a function.
  // IMPORTANT: The closure scope will not be carried forward for the function must be self-contained.
  // Default: `null`.
  mission: null,

  // Suppress all stdio from child processes
  // Default: `true`
  silent: true

};


var startTime,     // The timestamp from when `start` was invoked
    maxTimeoutId,  // The ID of the timeout that manages the total duration
    config,        // The active config for the Legion and all its subordinates
    theExitCode,   // Keep track of if the process is already exiting
    dead,          // Keep track of if the process is already been deemed dead
    centuryStartTimes = {};  // Timestamps of start for each century (informational only)


//
//
//
function Legion() {
  if (!(this instanceof Legion)) {
    return new Legion();
  }
}
util.inherits(Legion, EventEmitter);


//
// TO ARMS!!!
//
Legion.prototype.prepare = function(options) {

  // There can be only one!
  // ...due to the limitations of `cluster`.
  if (config) {
    throw new Error('Cannot create multiple Legion instances!');
  }

  // If no work was assigned, bail out (unless `mission` was not specified at all)
  if (options && options.hasOwnProperty('mission') && typeof options.mission !== 'function') {
    throw new TypeError('No `mission` was assigned!');
  }


  // Merge any user-overridden configuration
  config = extend({}, defaultConfig, options);


  // If the Node process is killed...
  process.on('exit', function(exitCode) {
    if (!dead) {
      theExitCode = exitCode;
      this.surrender(exitCode);
    }
  }.bind(this));


  // Configure the future cluster of Centuries
  cluster.setupMaster({
    exec:   require.resolve('./century'),
    args:   [],
    silent: config.silent === true
  });


  // When a Century is terminated...
  cluster.on('exit', function(century, exitCode, signal) {
    exitCode = typeof exitCode === 'number' ? exitCode : signal ? 128: 0;

    // Sound the death knell
    this.emit('terminate', {
      type: 'terminate',
      role: 'century',
      id: century.process.pid,
      group: process.pid,
      data: {
        reason: exitCode !== 0 ? 'killed' : 'discharged',
        exitCode: exitCode,
        activeDuty: Date.now() - centuryStartTimes[century.process.pid]
      }
    });

    // Cleanup metadata
    delete centuryStartTimes[century.process.pid];

    var hasCenturiesLeft = false;
    for (var centuryId in cluster.soldiers) {
      if (cluster.soldiers[centuryId].process.pid !== century.process.pid) {
        hasCenturiesLeft = true;
        break;
      }
    }

    if (!hasCenturiesLeft) {
      die.call(this, exitCode);
    }
  }.bind(this));

  return this;
};


//
// TO WAR!!!
//
Legion.prototype.toWar = function(mission) {
  if (startTime) {
    throw new Error('Do not call `toWar` more than once!');
  }

  if (typeof mission === 'function') {
    config.mission = mission;
  }

  // If no work was assigned, bail out
  if (typeof config.mission !== 'function') {
    throw new TypeError('No `mission` was assigned!');
  }


  // Mark the time
  startTime = Date.now();

  // Build your legion!
  this.emit('recruit', {
    type: 'recruit',
    role: 'legion',
    id: process.pid,
    group: null,
    data: {}
  });

  // Form your centuries!
  var century, centuryPid;
  for (var i = 0, len = config.maxCenturies; i < len; i++) {
    century = cluster.fork();
    centuryPid = century.process.pid;

    // Record the employment
    this.emit('recruit', {
      type: 'recruit',
      role: 'century',
      id: centuryPid,
      group: process.pid,
      data: {}
    });

    // Sir, I beseech you: listen to the soldiers!
    century.on('message', function(msg) {
      if (msg && msg.type && /^(century|soldier)$/.test(msg.role)) {
        this.emit(msg.type, msg);
      }
    }.bind(this));

    centuryStartTimes[centuryPid] = Date.now();

    // Cascade of recruitment!
    century.send({
      type: 'recruit',
      role: 'century',
      id: centuryPid,
      group: process.pid,
      config: {
        maxSoldiers: config.maxSoldiersPerCentury,
        stagger: config.stagger,
        staggeredStart: config.staggeredStart,
        reinforce: config.reinforce,
        maxMissionTime: config.maxActiveDutyPerMission,
        mission: config.mission.toString(),
        silent: config.silent === true
      }
    });
  }

  // Only allow this process chain to run for a max of `maxCommission` milliseconds
  if (typeof config.maxCommission === 'number' && config.maxCommission > 0) {
    maxTimeoutId = setTimeout(this.surrender.bind(this), config.maxCommission);
  }

  return this;
};


//
// All is lost!
//
Legion.prototype.surrender = function(exitCode) {
  // Die, soldiers! Die!
  for (var centuryId in cluster.soldiers) {
    cluster.soldiers[centuryId].kill();
  }

  return die.call(this, exitCode);
};


//
// Whether natural or at the hand of our enemy, we all eventually meet our end.
//
function die(exitCode) {
  var wasExitingAlready = typeof theExitCode !== 'number';
  var finalExitCode = wasExitingAlready ? theExitCode : typeof exitCode === 'number' ? exitCode : 0;

  // Sound the death knell
  this.emit('terminate', {
    type: 'terminate',
    role: 'legion',
    id: process.pid,
    group: null,
    data: {
      reason: finalExitCode !== 0 ? 'killed' : 'discharged',
      exitCode: finalExitCode,
      activeDuty: Date.now() - startTime
    }
  });

  // Empty out all of the global tracking variables
  clearTimeout(maxTimeoutId);
  maxTimeoutId = null;
  startTime = null;
  config = null;
  theExitCode = null;
  dead = true;

  // Exit forcibly but only if someone else didn't already invoke the exit
  if (!wasExitingAlready) {
    process.exit(finalExitCode);
  }

  return this;
};


// Export API
module.exports = new Legion();
