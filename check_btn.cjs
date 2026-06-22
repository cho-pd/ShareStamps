const http = require('http');
http.get('http://localhost:5174/', function(res) {
  let data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    // Check if discount-barcode-btn exists in rendered HTML
    const idx = data.indexOf('discount-barcode-btn');
    console.log('HTML length:', data.length);
    console.log('Found discount-barcode-btn at index:', idx);
    
    // Also check for the CSS
    const cssIdx = data.indexOf('#E5E5EA');
    console.log('Found #E5E5EA (silver) at index:', cssIdx);
    
    // Check for the index.css import
    const cssLink = data.indexOf('index.css');
    console.log('Found index.css reference at index:', cssLink);
    
    // Show a snippet
    if (idx > -1) {
      console.log('\nContext around discount-barcode-btn:');
      console.log(data.substring(Math.max(0, idx - 100), idx + 200));
    }
  });
});
