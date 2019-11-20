var htmlConvert = require('html-convert');
var fs = require('fs');
 
var convert = htmlConvert();
 
// or as a transform stream
 
fs.createReadStream("test.html")
  .pipe(convert())
  .pipe(fs.createWriteStream('out.png'))

  console.log("Fichier exporté!")