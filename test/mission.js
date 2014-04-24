// Internal modules
var Soldier = require('../soldier');


// Enlist the soldier and prepare him/her to receive orders to go to war
var warfarer =
  new Soldier()
    .on('war', function(orders) {
      this.emit('executing mission');
      setTimeout(this.terminate.bind(this), 5000);
    });