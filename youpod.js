const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Parser = require("rss-parser");
const download = require('download');
const { spawn } = require('child_process');
const express = require('express')
const config = require("./config.json")
const bodyParser = require('body-parser');
const randtoken = require('rand-token');
const sq = require('sqlite3');
const nodemailer = require("nodemailer");
const puppeteer = require('puppeteer');

var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		   user: config.mail,
		   pass: config.password
	   }
});

var app = express()
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
})); 

//Connexion à la base de donnée
sq.verbose();
var db = new sq.Database(__dirname + "/base.db");

//Reprise des générations en cas d'erreur
flush();
setInterval(flush, 1000 * 60 * 15);
restartGeneration();
 
var parser = new Parser();

app.get("/static/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "/web/static/", req.params.file))
})

app.get("/", (req, res) => {
  db.all(`SELECT count(*) FROM video WHERE status='waiting'`, (err, rows) => {
    template = fs.readFileSync(path.join(__dirname, "/web/index.mustache"), "utf8")

    var render_object = {
      "waiting_list": rows[0]["count(*)"],
      "keeping_time": config.keeping_time
    }
  
    res.setHeader("content-type", "text/html");
    res.send(mustache.render(template, render_object))
  })
})

app.get("/download/:id", (req, res) => {
  if (req.query.token != undefined) {
    db.all(`SELECT * FROM video WHERE id='${req.params.id}'`, (err, rows) => {
      if (rows.length >= 1) {
        if (req.query.token != rows[0].access_token) {
          res.status(403).send("Vous n'avez pas accès à cette vidéo")
        } else {
          if (rows[0].status == 'finished') {
            res.download(path.join(__dirname, "/video/", `output_${rows[0].id}.mp4`))
          } else if (rows[0].status == 'deleted') {
            res.status(404).send("Cette vidéo à été supprimée du site!")
          } else if (rows[0].status == 'during') {
            res.status(404).send("Cette vidéo est encore en cours de traitement, revenez plus tard!")
          } else {
            res.status(404).send("Cette vidéo est encore dans la file d'attente.")
          }
        }
      } else {
        res.status(404).send("Cette vidéo n'est pas disponible...")
      }
    })
  } else {
    res.status(404).send("Vous n'avez pas mis de token d'accès à une vidéo")
  }

})

app.post("/addvideo", (req, res) => {
  if (req.body.email != undefined && req.body.rss != undefined) {
    db.run(`INSERT INTO video(email, rss, access_token) VALUES ("${req.body.email}", "${req.body.rss}", "${randtoken.generate(32)}")`)
    initNewGeneration();
    res.send("Vidéo correctement ajoutée à la liste!")
  } else {
    res.status(400).send("Votre requète n'est pas complète...")
  }

})

// FONCTION DE GENERATIONS
function restartGeneration() {
  console.log("Reprise de générations...")
  db.each(`SELECT * FROM video WHERE status='during'`, (err, row) => {
    generateFeed(row.rss, row.id)
  })

  initNewGeneration();
}

function flush() {
  db.all(`SELECT * FROM video WHERE status='finished'`, (err, rows) => {
    if (rows.length >=1) {
      for (i = 0; i < rows.length; i++) {
        time = Date.now() - rows[i].end_timestamp
        time = time / (1000 * 60 * 60);
    
        if (time > config.keeping_time) {
          fs.unlinkSync(path.join(__dirname, "/video/", `output_${rows[i].id}.mp4`))
          db.run(`UPDATE video SET status='deleted' WHERE id=${rows[i].id}`);
          console.log("Flush video " + rows[i].id)
    
        }
      }
    }
  })
}

function initNewGeneration() {
  db.all(`SELECT count(*) FROM video WHERE status='during'`, (err, rows) => {
    if (rows[0]["count(*)"] < config.max_during) {
      db.all(`SELECT * FROM video WHERE status='waiting'`, (err, rows) => {
        if(rows.length >= 1) {
          db.run(`UPDATE video SET status='during' WHERE id=${rows[0].id}`);
          generateFeed(rows[0].rss, rows[0].id)
        }
      })
    }
  })
}

function generateFeed(feed_url, id) {
  console.log(id + " Démarage de la création")
  parser.parseURL(feed_url, (err, lFeed) => {
    console.log(id + " Récupération du flux")
    feed = lFeed

    var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");

    var renderObj = {
      "imageURL": feed.image.url,
      "epTitle": feed.items[0].title,
      "podTitle": feed.title,
      "podSub": feed.itunes.subtitle
    }

    string = mustache.render(template, renderObj);

    console.log(id + " Génération de l'image");
    
    (async () => {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1920,
          height: 1080
        },
        headless: true,
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(string);
      await page.screenshot({path: path.join(__dirname, "/tmp/", `overlay_${id}.png`), omitBackground: true});
    
      await browser.close();
      console.log(id + " Image générée!")
      downloadAudio(id)
    })();
  })
}

function downloadAudio(id) {
  console.log(id + " Démarage du téléchargement")
  download(feed.items[0].enclosure.url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
    console.log(id + " Fichier téléchargé!");
    generateVideo(id);
  });
}

function generateVideo(id) {
  console.log(id + " Démarage de la génération de la vidéo")

  var child = spawn("ffmpeg", ["-y", "-i", "./loop/loop.mp4", "-i", `./tmp/overlay_${id}.png`, "-filter_complex", 'overlay=0:0', "-i", `./tmp/audio_${id}.mp3`, "-shortest", "-acodec", "copy", `./video/output_${id}.mp4`]);

  child.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  child.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  child.on('close', function (code) {
    console.log(id + " Vidéo générée!")
    db.run(`UPDATE video SET status='finished', end_timestamp='${Date.now()}' WHERE id=${id}`);
    fs.unlinkSync(path.join(__dirname, "/tmp/", `overlay_${id}.png`))
    fs.unlinkSync(path.join(__dirname, "/tmp/", `audio_${id}.mp3`))

    sendMail(id);
    initNewGeneration();
  });
}

function sendMail(id) {
  db.all(`SELECT * FROM video WHERE id='${id}'`, (err, rows) => {
    template = fs.readFileSync(path.join(__dirname, "/web/mail.mustache"), "utf8")
    renderObj = {
      "rss_link": rows[0].rss,
      "keeping_time": config.keeping_time,
      "video_link": config.host + "/download/" + id + "?token=" + rows[0].access_token
    }

    const mailOptions = {
      from: 'youpod@balado.tools', // sender address
      to: rows[0].email, // list of receivers
      subject: `Vidéo générée sur Youpod!`, // Subject line
      html: mustache.render(template, renderObj)
    };
    
    transporter.sendMail(mailOptions, function (err, info) {
      if(err) return console.log(err)
    });

    db.run(`UPDATE video SET email='deleted' WHERE id=${id}`);
  })
}

function generateLoop(duration) {
  string = "";

  for(i = 0; i < duration * 3; i++) {
    string = string + "file 'loop.mp4'\n"
  }

  fs.writeFileSync(path.join(__dirname, "assets/list.txt"), string);
  exec(`ffmpeg -y -f concat -i ./assets/list.txt ./loop/loop_${duration}.mp4`, {cmd: __dirname}, (err, stdout, stderr) => {
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