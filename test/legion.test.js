// Internal modules
var legion = require('../legion');


function dumpMessage(msg) {
  console.log(JSON.stringify(msg));
}

legion
  .prepare({
    mission: require.resolve('./mission'),
    stagger: true,
    staggeredStart: 2500,
    silent: false
  })
  .on('recruit', dumpMessage)
  .on('terminate', dumpMessage)
  .toWar({
    missionParameters: 'whatever data',
    secretObjective: 'you want to send',
    exitConditions: 'to your soldiers',
    dirtyJoke: 'can be passed as an object to `toWar`'
  });