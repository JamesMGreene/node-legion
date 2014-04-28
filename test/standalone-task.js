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
process.emit('running', { 'info': 'executing task standalone' });
setTimeout(process.exit, 5000);