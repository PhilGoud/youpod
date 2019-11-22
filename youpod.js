const htmlConvert = require('html-convert');
const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Parser = require("rss-parser");
const download = require('download');
const { exec } = require('child_process');
const express = require('express')
const config = require("./config.json")
const bodyParser = require('body-parser');

var app = express()
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
})); 
 
var convert = htmlConvert();
var parser = new Parser();
var feed;

var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");

app.get("/static/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "/web/static/", req.params.file))
})

app.get("/", (req, res) => {
  template = fs.readFileSync(path.join(__dirname, "/web/index.mustache"), "utf8")

  var render_object = {
    "waiting_list": 0
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, render_object))
})

app.post("")

// FONCTION DE GENERATIONS
function generateFeed(feed_url) {
  console.log("Démarage de la création")
  parser.parseURL("http://glebeskefe.lepodcast.fr/rss", (err, lFeed) => {
    console.log("Récupération du flux")
    feed = lFeed

    var renderObj = {
      "imageURL": feed.image.url,
      "epTitle": feed.items[0].title,
      "podTitle": feed.title,
      "podSub": feed.itunes.subtitle
    }

    var string = mustache.render(template, renderObj)
    fs.writeFileSync(path.join(__dirname, "tmp", "page.html"), string);

    console.log("Génération de l'image");

    stream = fs.createReadStream(path.join(__dirname, "tmp", "page.html"))
      .pipe(convert())
      .pipe(fs.createWriteStream(path.join(__dirname, "tmp", "overlay.png")))
      
    stream.on("finish", downloadAudio);
  })
}

function downloadAudio() {
  console.log("Démarage du téléchargement")
  download(feed.items[0].enclosure.url).then(data => {
    fs.writeFileSync(path.join(__dirname, "/tmp/audio.mp3"), data);
    console.log("Fichier téléchargé!");
    generateVideo();
  });
}

function generateVideo() {
  console.log("Démarage de la génération de la vidéo")

  exec(`ffmpeg -i ./loop/loop.mp4 -i ./tmp/overlay.png -filter_complex "overlay=0:0" -i ./tmp/audio.mp3 -shortest -acodec copy ./tmp/output.mp4`, {cmd: __dirname}, (err, stdout, stderr) => {
    if(err == undefined) {
      console.log("Vidéo générée!")
    }
  })
}

function generateLoop(duration) {
  string = "";

  for(i = 0; i < duration * 3; i++) {
    string = string + "file 'loop.mp4'\n"
  }

  fs.writeFileSync(path.join(__dirname, "assets/list.txt"), string);
  exec(`ffmpeg -f concat -i ./assets/list.txt ./loop/loop_${duration}.mp4`, {cmd: __dirname}, (err, stdout, stderr) => {
    console.log(err)
    console.log(stdout)
    console.log(stderr)
  })
}

//Ouverture du serveur Web sur le port définit dans config.json
app.listen(config.port, () => console.log(`Serveur lancé sur le port ${config.port}`))

/*
CREATE TABLE "video" (
	"id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	"email"	TEXT NOT NULL,
	"rss"	TEXT NOT NULL,
	"access_token"	TEXT NOT NULL,
	"end_timestamp"	TEXT NOT NULL,
	"status"	TEXT NOT NULL CHECK(status in ("waiting","finished","deleted"))
);
*/