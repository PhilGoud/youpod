const htmlConvert = require('html-convert');
const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Parser = require("rss-parser");
 
var convert = htmlConvert();
var parser = new Parser();

var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");

parser.parseURL("https://point-games.lepodcast.fr/rss", (err, feed) => {
  var renderObj = {
    "imageURL": feed.image.url,
    "epTitle": feed.items[0].title,
    "podTitle": feed.title,
    "podSub": feed.itunes.subtitle
  }

  var string = mustache.render(template, renderObj)
  fs.writeFileSync(path.join(__dirname, "tmp", "page.html"), string);

  fs.createReadStream(path.join(__dirname, "tmp", "page.html"))
    .pipe(convert())
    .pipe(fs.createWriteStream(path.join(__dirname, "tmp", "out.png")))
})