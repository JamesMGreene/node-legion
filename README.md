# node-legion

> "I am Legion, for we are many." &mdash; _Mark, 5:9_

Raise a legion of Node worker processes to do your bidding.


## Installation

```sh
npm install legion
```


## Usage

### Main file:

```js
var orders = {
  purpose: 'any JSON-serializable data that you want to provide to your Soldiers'
};

var legion = require('legion');
legion
  .prepare({
    mission: path.join(__dirname, 'mission.js')
  })
  .on('recruit', console.dir)
  .on('terminate', console.dir)
  .toWar(orders);
```

### "Mission" file for Soldiers:

```js
var Soldier = require('legion/soldier');

// Enlist the soldier and prepare him/her to receive orders to go to war
var warfarer =
  new Soldier()
    .on('war', function(orders) {
      this.emit('executing mission');
      setTimeout(this.terminate.bind(this), 5000);
    });
```

## Configuration Options

```js
var defaultConfig = {

  // The number of centuries.
  // Default: `require('os').cpus().length` (1 per CPU)
  maxCenturies: os.cpus().length,

  // The maximum number of concurrent soldiers per century.
  // Default: `8`.
  maxSoldiersPerCentury: 8,

  // Should the initial creation of soldiers be staggered?
  // Default: `false`.
  stagger: false,

  // The number of milliseconds to use as a staggered start time for soldiers.
  // Only relevant if `stagger` is set to `true`.
  // Default: `5000` (5 seconds).
  staggeredStart: 5000,

  // When one soldier finishes, should a new soldier "take the next shift"?
  // Note that if `stagger` is set to `true`, reinforcements will continue to
  // honor the `staggeredStart` delay.
  // Default: `true`.
  reinforce: true,

  // The number of milliseconds to use as the maximum allowed run time for a
  // single execution of the `mission`. When the limit is reached, the soldier will
  // be forcibly killed if the `mission` has not been completed.
  // Default: `null` (infinite time)
  maxActiveDutyPerMission: null,

  // The number of milliseconds to use as the maximum allowed run time for the
  // entire process. If you have reinforceing soldiers, they will continue to work
  // until this limit is reached, and then the "Legion" will kill all of its
  // subordinates.
  // Default: `null` (infinite time)
  maxCommission: null,

  // The actual work to do. This MUST be set to an existing file path.
  // Default: `null`.
  mission: null,

  // Suppress all stdio from child processes
  // Default: `true`
  silent: true

};
```
