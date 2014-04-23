// Userland modules
var extend = require('node.extend');


var defaultConfig = {

  // The actual work to do. This MUST be set to a function.
  // Default: `null`.
  mission: null

};


var config,    // The active config for the Soldier
    groupPid;  // The owner process's PID


var soldierInterface = {

  emit: function(eventName, eventData) {
    if (!(typeof eventName === 'string' && eventName)) {
      throw new TypeError('`eventName` must be a non-empty string');
    }
    if (/^(recruit|terminate)$/.test(eventName)) {
      throw new TypeError('"recruit" and "terminate" are disallowed `eventName` values');
    }

    process.send({
      type: eventName,
      role: 'soldier',
      id: process.pid,
      group: groupPid,
      data: typeof eventData !== 'undefined' ? eventData : {}
    });
  },

  done: function(err) {
    process.exit(err ? 1 : 0);
  }

};


// If the Century tells you that you're recruited, get to work!
process.on('message', function(msg) {
  if (msg && msg.type === 'recruit' && msg.role === 'soldier') {

    // Rehydrate the `mission` function
    if (msg && msg.config && typeof msg.config.mission === 'string') {
      msg.config.mission = Function('return (' + msg.config.mission + ')')();
    }

    config = extend({}, defaultConfig, msg.config);
    groupPid = msg.group || null;

    process.nextTick(doWork);
  }
});


//
//
//
function doWork() {
  if (typeof config.mission !== 'function') {
    throw new TypeError('No `mission` was assigned!');
  }

  config.mission.call(soldierInterface);
}