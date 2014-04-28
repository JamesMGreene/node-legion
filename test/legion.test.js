// Internal modules
var Legion = require('../legion');


function dumpMessage(msg) {
  console.log(JSON.stringify(msg));
}

var legion =
  new Legion({
    taskScript: require.resolve('./task'),
    stagger: true,
    staggeredStart: 2500,
    maxWorkerTime: 2500,
    maxTime: 10000,
    silent: false
  })
  .on('start', dumpMessage)
  .on('end', dumpMessage)
  .on('error', dumpMessage)
  .run({
    taskParameters: 'whatever data',
    secretObjective: 'you want to send',
    exitConditions: 'to your workers',
    dirtyJoke: 'can be passed as an object to `run`'
  });