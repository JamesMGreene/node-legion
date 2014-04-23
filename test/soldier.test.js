// Internal modules
require('../src/soldier');  // Runs as `process`


var messageListenerAdded = false;

// Shim in `process.send` if running as the main module
if (typeof process.send === 'undefined' && require.main === module) {
  process.send = function(msg) {
    if (msg && msg.config && typeof msg.config.mission === 'function') {
      msg.config.mission = msg.config.mission.toString();
    }

    var returnVal = process.emit('message', msg);

    // Stall adding this till after the first message is sent
    if (!messageListenerAdded) {
      process.on('message', function(msg) { console.log(JSON.stringify(msg)); });
      messageListenerAdded = true;
    }

    return returnVal;
  };
}

// Simulate recruitment from the Century
process.send({
  type: 'recruit',
  role: 'soldier',
  id: process.pid,
  group: null,
  config: {
    mission: function() {
      this.emit('executing mission');
      setTimeout(this.done.bind(this), 5000);
    }
  }
});