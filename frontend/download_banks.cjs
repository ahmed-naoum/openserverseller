const fs = require('fs');
const https = require('https');
const path = require('path');

const urls = [
  'https://app.coliaty.com/assets/images/banks/cih.png',
  'https://app.coliaty.com/assets/images/banks/attijari.png',
  'https://app.coliaty.com/assets/images/banks/albarid-bank.png',
  'https://app.coliaty.com/assets/images/banks/boa_nouveau_logo.png',
  'https://app.coliaty.com/assets/images/banks/bcp_logo.png',
  'https://app.coliaty.com/assets/images/banks/bmci.png',
  'https://app.coliaty.com/assets/images/banks/ca.png',
  'https://app.coliaty.com/assets/images/banks/cfg.png',
  'https://app.coliaty.com/assets/images/banks/cdg_capital_logo.png',
  'https://app.coliaty.com/assets/images/banks/cdm.png',
  'https://app.coliaty.com/assets/images/banks/logo-societe-generale.png',
  'https://app.coliaty.com/assets/images/banks/bank_assafa.png',
  'https://app.coliaty.com/assets/images/banks/Bank_Al_Yousr.png',
  'https://app.coliaty.com/assets/images/banks/Umnia_Bank.png'
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
        file.close();  // close() is async, call cb after close completes.
        console.log('Downloaded: ' + filename);
      });
    } else {
      console.log('Failed to download: ' + url + ' (Status: ' + response.statusCode + ')');
    }
  }).on('error', function(err) {
    fs.unlink(dest, () => {}); // Delete the file async. (But we don't check the result)
    console.error('Error downloading ' + url + ': ' + err.message);
  });
});
