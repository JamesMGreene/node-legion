// If this file is executed directly...
if (process.argv[1] === __filename) {
  process.on('running', function(e) {
    console.log('running');
    console.dir(e);
  });
}
else {
  console.log('Child...');
}

//
// Actual contents
//
process.on('start', function(taskData) {
  process.emit('running', { 'info': 'executing task', data: taskData });
  setTimeout(process.exit, 5000);
});

process.on('error', function(err) {
  process.emit('error', {
    'err': {
      'name': err.name || 'Error',
      'message': err.message || '',
      'fileName': err.fileName || '',
      'lineNumber': err.lineNumber || 0,
      'columnNumber': err.columnNumber || 0,
      'stack': err.stack || ''
    }
  });
});


// If this file is executed directly...
if (process.argv[1] === __filename) {
  process.emit('start', { direct: 'run' });
}
