// Core modules
var child_process = require('child_process');


// Create the Worker
var cp = child_process.fork(
  require.resolve('../worker'),
  [require.resolve('./task')],
  { silent: false }
);

cp.on('message', function(msg) {
  if (msg && msg.type && msg.role === 'worker' && msg.id === cp.pid && msg.owner === process.pid) {
    console.log(JSON.stringify(msg));
  }
});

// Simulate hiring from the Legion
cp.send({
  type: 'start',
  role: 'worker',
  id: cp.pid,
  owner: process.pid,
  data: {
    instructions: 'are here'
  }
});