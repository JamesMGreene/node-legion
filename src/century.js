// Core modules
var fork = require('child_process').fork;

// Userland modules
var extend = require('node.extend');


var defaultConfig = {

  // The maximum number of concurrent soldiers per century.
  // Default: `8`.
  maxSoldiers: 8,

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
  maxMissionTime: null,

  // The actual work to do. This MUST be set to a function.
  // Default: `null`.
  mission: null,

  // Suppress all stdio from child processes
  // Default: `true`
  silent: true

};


var startTimes = {},     // The timestamps from when each soldier started
    maxTimeoutIds = {},  // The ID of the timeout that manages the total duration
    soldiers = {},       // Track the soldiers so that we know who all can be terminated
    config,              // The active config for the Century and all its subordinates
    groupPid;            // The owner's process's PID



// If the Node process is being forcibly killed, try to clean up as best as possible
process.on('exit', function(exitCode) {
  if (exitCode !== 0) {
    for (var soldierId in soldiers) {
      soldiers[soldierId].kill();
    }
  }
});

// If the Boss tells you that you're recruitd, start recruiting Soldiers!
process.on('message', function(msg) {
  if (msg && msg.type === 'recruit' && msg.role === 'century') {

    // Rehydrate the `mission` function
    if (msg && msg.config && typeof msg.config.mission === 'string') {
      msg.config.mission = Function('return (' + msg.config.mission + ')')();
    }

    config = extend({}, defaultConfig, msg.config);
    groupPid = msg.group || null;

    process.nextTick(recruitAllSoldiers);
  }
});


//
//
//
function recruitAllSoldiers() {
  if (typeof config.mission !== 'function') {
    throw new TypeError('No `mission` was assigned!');
  }

  // Make `maxSoldiers` soldiers for this Century!
  var soldierCount = 0;

  // If not staggering, just recruit them all ASAP!
  if (!(config.stagger === true && typeof config.staggeredStart === 'number' && config.staggeredStart >= 0)) {
    for (; soldierCount < config.maxSoldiers; soldierCount++) {
      recruitSoldier();
    }
  }
  // Otherwise pace your recruiting....
  else {
    var recruitingIntervalId = setInterval(function() {
      if (soldierCount < config.maxSoldiers) {
        recruitSoldier();
        soldierCount++;
      }
      else {
        clearInterval(recruitingIntervalId);
        recruitingIntervalId = null;
      }
    }, config.staggeredStart);
  }
}


// Soldier's soldier (a.k.a. breeder)
function recruitSoldier() {

  var soldier = fork(require.resolve('./soldier'), [], { silent: config.silent === true });

  // Record the employment
  process.send({
    type: 'recruit',
    role: 'soldier',
    id: soldier.pid,
    group: process.pid,
    data: {}
  });

  // Voice the Soldiers' concerns to the Boss
  soldier.on('message', function(msg) {
    process.send(msg);
  });

  soldier.on('exit', function(exitCode, signal) {
    exitCode = typeof exitCode === 'number' ? exitCode : signal ? 128 : 0;

    // Clear any timeouts
    clearTimeout(maxTimeoutIds[soldier.pid]);

    // Sound the death knell
    process.send({
      type: 'terminate',
      role: 'soldier',
      id: soldier.pid,
      group: process.pid,
      data: {
        reason: exitCode !== 0 ? 'killed' : 'discharged',
        exitCode: exitCode,
        duration: Date.now() - startTimes[soldier.pid]
      }
    });

    // Clean up metadata
    delete soldiers[soldier.pid];
    delete maxTimeoutIds[soldier.pid];
    delete startTimes[soldier.pid];

    // Reinforcements!!! Rise from the ashes!
    // Create another soldier thread when soldier is terminated
    if (config.reinforce === true) {
      if (config.stagger === true && typeof config.staggeredStart === 'number' && config.staggeredStart >= 0) {
        setTimeout(recruitSoldier, config.staggeredStart);
      }
      else {
        process.nextTick(recruitSoldier);
      }
    }
  });

  // Record metadata
  startTimes[soldier.pid] = Date.now();

  // Get started
  soldier.send({
    type: 'recruit',
    role: 'soldier',
    id: soldier.pid,
    group: process.pid,
    config: {
      mission: config.mission.toString()
    }
  });

  // Only allow this process chain to run for a max of `maxRunTime` milliseconds
  if (typeof config.maxMissionTime === 'number' && config.maxMissionTime > 0) {
    maxTimeoutIds[soldier.pid] = setTimeout(function() {
      soldier.kill();
    }, config.maxMissionTime);
  }

  // Keep a reference to the Soldier for termination
  soldiers[soldier.pid] = soldier;

}
