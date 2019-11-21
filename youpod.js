const htmlConvert = require('html-convert');
const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const str = require('string-to-stream')
 
var convert = htmlConvert();

var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");

var renderObj = {
  "imageURL": "https://manette-de-proust.lepodcast.fr/cover",
  "epTitle": "Manette de Proust #15 : Super Mario World",
  "podTitle": "Manette de Proust",
  "podSub": "On a tous un jeu qui nous fait retourner en enfance."
}

var string = mustache.render(template, renderObj)

str(string)
  .pipe(convert())
  .pipe(fs.createWriteStream('out.png'))

  console.log("Fichier exporté!")