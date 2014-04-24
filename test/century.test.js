// Internal modules
require('../century');  // Runs as `process`


var messageListenerAdded = false;

// Shim in `process.send` if running as the main module
if (typeof process.send === 'undefined' && require.main === module) {
  process.send = function(msg) {
    var returnVal = process.emit('message', msg);

    // Stall adding this till after the first message is sent
    if (!messageListenerAdded) {
      process.on('message', function(msg) { console.log(JSON.stringify(msg)); });
      messageListenerAdded = true;
    }

    return returnVal;
  };
}

// Simulate recruitment from the Legion
process.send({
  type: 'recruit',
  role: 'century',
  id: process.pid,
  group: null,
  config: {
    mission: require.resolve('./mission'),
    silent: false
  }
});