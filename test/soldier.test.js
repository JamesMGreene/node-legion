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


//
// Execute the "mission.js" file contents in place so we aren't duplicating it.
// This would NOT be a normal consumer practice.
//
var missionCode = require('fs').readFileSync(require.resolve('./mission'), 'utf8');
Function(
  'exports', 'require', 'module', '__filename', '__dirname', 'global', 'console', missionCode
)(exports, require, module, __filename, __dirname, global, console);


// Simulate recruitment from the Century
process.send({
  type: 'recruit',
  role: 'soldier',
  id: process.pid,
  group: null
});
