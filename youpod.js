const htmlConvert = require('html-convert');
const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Parser = require("rss-parser");
const download = require('download');
const { exec } = require('child_process');
 
var convert = htmlConvert();
var parser = new Parser();
var feed;

var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");

parser.parseURL("https://script.lepodcast.fr/rss", (err, lFeed) => {
  feed = lFeed

  var renderObj = {
    "imageURL": feed.image.url,
    "epTitle": feed.items[0].title,
    "podTitle": feed.title,
    "podSub": feed.itunes.subtitle
  }

  var string = mustache.render(template, renderObj)
  fs.writeFileSync(path.join(__dirname, "tmp", "page.html"), string);

  stream = fs.createReadStream(path.join(__dirname, "tmp", "page.html"))
    .pipe(convert())
    .pipe(fs.createWriteStream(path.join(__dirname, "tmp", "out.png")))
    
  stream.on("finish", downloadAudio);
})

function downloadAudio() {
  console.log("Démarage du téléchargement")
  download(feed.items[0].enclosure.url).then(data => {
    fs.writeFileSync(path.join(__dirname, "/tmp/audio.mp3"), data);
    console.log("Fichier téléchargé!");
  });
}