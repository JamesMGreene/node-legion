// Internal modules
var Legion = require('../src/legion');


function dumpMessage(msg) {
  console.log(JSON.stringify(msg));
}

var legion =
  new Legion({
    mission: function() {
      this.emit('executing mission');
      setTimeout(this.done.bind(this), 5000);
    },
    stagger: true,
    staggeredStart: 1000,
    silent: false
  })
  .on('recruit', dumpMessage)
  .on('terminate', dumpMessage);

legion.toWar();