// Core modules
var util = require('util');
var EventEmitter = require('events').EventEmitter;


//
//
//
function Soldier() {
  
  this.id = process.pid;

  // The owner process's PID
  this.group = null;

  // Special orders
  this.orders = undefined;

  // Brainwashing...
  followOrders.call(this);
}
util.inherits(Soldier, EventEmitter);


// Override `emit`
Soldier.prototype.emit = (function(_emit) {
  return function(eventName, eventData) {
    if (!(typeof eventName === 'string' && eventName)) {
      throw new TypeError('`eventName` must be a non-empty string');
    }
    if (/^(recruit|terminate)$/.test(eventName)) {
      throw new TypeError('"recruit" and "terminate" are disallowed `eventName` values');
    }

    // If we are a child process [as expected], emit to the parent process
    if (typeof process.send === 'function') {
      process.send({
        type: eventName,
        role: 'soldier',
        id: this.id,
        group: this.group,
        data: typeof eventData !== 'undefined' ? eventData : {}
      });
    }

    // Invoke the regular `emit` method, too
    return _emit.apply(this, Array.prototype.slice.call(arguments, 0));
  };
})(Soldier.prototype.emit);


//
//
//
Soldier.prototype.terminate = function(killed) {
  process.exit(killed ? 1 : 0);
};


//
// Brainwashing...
//
function followOrders() {
  // If the Century tells you that you're recruited, get to work!
  process.on('message', function(msg) {
    if (msg && msg.type === 'recruit' && msg.role === 'soldier') {
      this.group = msg.group || null;
      this.orders = (msg.config && msg.config.orders) || undefined;

      process.nextTick(function() {
        this.emit('war', this.orders);
      }.bind(this));
    }
  }.bind(this));
}


// Export class
module.exports = Soldier;
