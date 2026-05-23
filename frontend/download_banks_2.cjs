const fs = require('fs');
const https = require('https');
const path = require('path');

const urls = [
  'https://app.coliaty.com/assets/images/banks/cihbank.png',
  'https://app.coliaty.com/assets/images/banks/attijaribank.png'
];

const dir = path.join(__dirname, 'public', 'banks');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

urls.forEach(url => {
  const filename = url.split('/').pop();
  const dest = path.join(dir, filename);
  const file = fs.createWriteStream(dest);
  
  https.get(url, function(response) {
    if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', function() {
        file.close(); 
        console.log('Downloaded: ' + filename);
      });
    } else {
      console.log('Failed to download: ' + url + ' (Status: ' + response.statusCode + ')');
    }
  }).on('error', function(err) {
    fs.unlink(dest, () => {}); 
    console.error('Error downloading ' + url + ': ' + err.message);
  });
});
