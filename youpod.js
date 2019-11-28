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

app.get("/template/:name", (req, res) => {
  template = fs.readFileSync(path.join(__dirname, "/template/" + req.params.name + ".mustache"), "utf8")

  var renderObj = {
    "imageURL": "https://glebeskefe.lepodcast.fr/cover",
    "epTitle": "Ceci est un super titre d'épisode!",
    "podTitle": "Super Podcast",
    "podSub": "Parfois dans la vie on a des coups de haut et des coups de bas..."
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, renderObj))
})

app.get("/custom", (req, res) => {
  db.all(`SELECT count(*) FROM video WHERE status='waiting' OR status='during'`, (err, rows) => {
    template = fs.readFileSync(path.join(__dirname, "/web/custom.mustache"), "utf8")

    var render_object = {
      "waiting_list": rows[0]["count(*)"],
      "keeping_time": config.keeping_time
    }
  
    res.setHeader("content-type", "text/html");
    res.send(mustache.render(template, render_object))
  })
})

app.get("/", (req, res) => {
  db.all(`SELECT count(*) FROM video WHERE status='waiting' OR status='during'`, (err, rows) => {
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
            res.download(path.join(__dirname, "/video/", `output_${rows[0].id}.mp4`), `youpod_${rows[0].end_timestamp}.mp4`)
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
  if (req.body.email != undefined && req.body.rss != undefined && req.body.selectEp != undefined) {
    db.run(`INSERT INTO video(email, rss, guid, template, access_token) VALUES ("${req.body.email}", "${req.body.rss}", "${req.body.selectEp}", ?, "${randtoken.generate(32)}")`, req.body.template)
    initNewGeneration();
    res.send("Vidéo correctement ajoutée à la liste!")
  } else {
    res.status(400).send("Votre requète n'est pas complète...")
  }

})

app.post("/addvideocustom", (req, res) => {
  if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
    db.run(`INSERT INTO video(email, rss, template, access_token, epTitle, epImg, podTitle, podSub, audioURL) VALUES ("${req.body.email}", "__custom__", ?, "${randtoken.generate(32)}", ?, ?, ?, ?, ?)`, [req.body.template, req.body.epTitle, req.body.imgURL, req.body.podTitle, req.body.podSub, req.body.audioURL])    
    
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
    if (row.rss != "__custom__") {
      generateFeed(row.rss, row.guid, row.template, row.id)
    } else {
      generateImgCustom(row.id);
    }
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
          if (rows[0].rss != "__custom__") {
            generateFeed(rows[0].rss, rows[0].guid, rows[0].template, rows[0].id)
          } else {
            generateImgCustom(rows[0].id);
          }
        }
      })
    }
  })
}

function generateImgCustom(id) {
  console.log(id + " Démarage de la création");

  db.each(`SELECT * FROM video WHERE id=${id}`, (err, row) => {
    if (row.template != "") {
      template = row.template
    } else {
      var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");
    }

    var renderObj = {
      "imageURL": row.epImg,
      "epTitle": row.epTitle,
      "podTitle": row.podTitle,
      "podSub": row.podSub
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

      downloadAudioCustom(id, row.audioURL)
    })();
  })
}

function generateFeed(feed_url, guid, temp, id) {
  console.log(id + " Démarage de la création")
  parser.parseURL(feed_url, (err, lFeed) => {
    console.log(id + " Récupération du flux")
    feed = lFeed

    if (temp != "") {
      template = temp
    } else {
      var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");
    }

    i = 0;
    while(feed.items[i].guid != guid && i < feed.items.length) {
      i++;
    }

    if (i == feed.items.length) {
      db.run(`UPDATE video SET email='error' WHERE id=${id}`);
      return;
    }

    if(feed.items[i].itunes.image == undefined) {
      img = feed.image.link
    } else {
      img = feed.items[i].itunes.image
    }

    var renderObj = {
      "imageURL": img,
      "epTitle": feed.items[i].title,
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
      downloadAudio(id, feed.items[i].enclosure.url)
    })();
  })
}

function downloadAudioCustom(id, audio_url) {
  console.log(id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
    console.log(id + " Fichier téléchargé!");
    generateVideo(id);
  });
}

function downloadAudio(id, audio_url) {
  console.log(id + " Démarage du téléchargement")
  download(audio_url).then(data => {
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

    if (rows[0].rss != "__custom__") {
      template = fs.readFileSync(path.join(__dirname, "/web/mail.mustache"), "utf8")
      renderObj = {
        "rss_link": rows[0].rss,
        "keeping_time": config.keeping_time,
        "video_link": config.host + "/download/" + id + "?token=" + rows[0].access_token
      }
    } else {
      template = fs.readFileSync(path.join(__dirname, "/web/mail_custom.mustache"), "utf8")
      renderObj = {
        "ep_title": rows[0].epTitle,
        "keeping_time": config.keeping_time,
        "video_link": config.host + "/download/" + id + "?token=" + rows[0].access_token
      }
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