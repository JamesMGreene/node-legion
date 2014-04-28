# node-legion

> "I am Legion, for we are many." &mdash; _Mark, 5:9_

Raise a legion of Node worker child processes to do your bidding.

If your tasks are asynchronous and creating child processes is too expensive
for your taste, check out the [`chain-gang`](https://github.com/technoweenie/node-chain-gang) module as a possible alternative.


## Installation

```sh
npm install legion
```


## Usage

### Main file:

```js
var taskData = {
  purpose: 'JSON-serializable data you want to provide to your Workers'
};

var Legion = require('legion');
var legion =
  new Legion({
    taskScript: require.resolve('./task'),
    silent: false,
    maxWorkers: 100
  })
  .on('start', console.dir)
  .on('end', console.dir)
  .on('error', console.dir)
  .run(taskData);
```


### "Task" file for Worker:

You just use `process.on`, `process.emit`, and `process.exit` in your task script
to communicate with the Legion parent process. No Legion-specific hooks or
consumptions are required.

```js
process.on('start', function(taskData) {
  process.emit('running', { message: 'executing task', data: taskData });
  setTimeout(process.exit, 5000);
});
```

If your task doesn't require any "taskData" at runtime, then you can choose to
NOT listen for the `start` event and just get started, e.g.:

```js
process.emit('running', { message: 'executing task' });
setTimeout(process.exit, 5000);
```


## Configuration Options

```js
var defaultConfig = {

  // The number of workers.
  // Default: `require('os').cpus().length` (1 per CPU)
  maxWorkers: os.cpus().length,

  // Should the initial creation of workers be staggered?
  // Default: `false`.
  stagger: false,

  // The number of milliseconds to use as a staggered start time for workers.
  // Only relevant if `stagger` is set to `true`.
  // Default: `5000` (5 seconds).
  staggeredStart: 5000,

  // When one worker finishes, should a new worker "take the next shift"?
  // Note that if `stagger` is set to `true`, reinforcements will continue to
  // honor the `staggeredStart` delay.
  // Default: `true`.
  continuous: true,

  // The number of milliseconds to use as the maximum allowed run time for a
  // single execution of the `mission`. When the limit is reached, the soldier will
  // be forcibly killed if the `mission` has not been completed.
  // Default: `null` (infinite time)
  maxWorkerTime: null,

  // The number of milliseconds to use as the maximum allowed run time for the
  // entire process. If you have reinforceing workers, they will continue to work
  // until this limit is reached, and then the Legion will kill off all of its
  // subordinates.
  // Default: `null` (infinite time)
  maxTime: null,

  // The actual work to do. This MUST be set to an existing file path.
  // Default: `null`.
  taskScript: null,

  // Suppress all stdio from Worker processes
  // Default: `true`
  silent: true

};
```
