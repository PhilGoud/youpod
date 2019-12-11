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
const session = require('express-session');
const csurf = require('csurf')
const getMP3Duration = require('get-mp3-duration')

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

var csrfProtection = csurf()

//Configuration du cookie de session
app.use(session({
  secret: config.cookie_secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

app.use(csurf())
// error handler
app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err)

  // handle CSRF token errors here
  res.status(403)
  res.send("Bad CSRF")
})


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

app.get("/login", csrfProtection, (req, res) => {
  template = fs.readFileSync(path.join(__dirname, "/web/login.mustache"), "utf8")

  var render_object = {
    "msg": req.session.message,
    "csrfToken": req.csrfToken,
    "cb": req.query.return
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, render_object))
})

app.post("/authenticate", csrfProtection, (req, res) => {
  if (req.body.password != undefined) {
    if (req.body.password != config.gen_pwd) {
      req.session.message = "Mot de passe incorrect";

      req.session.save(function(err) {
        res.redirect("/login?return=" + req.body.return)
      })
    } else {
      if (req.body.password == config.gen_pwd) {
        req.session.logged = true;
        req.session.message = undefined;

        req.session.save(function(err) {
          if (req.body.return != "") {
            res.redirect("/" + req.body.return)
          } else {
            res.redirect("/")
          }
        })

      }
    }
  } else {
    res.redirect("/login")
  }
})

app.get("/preview", csrfProtection, (req, res) => {
  if (config.gen_pwd == "") {
    db.all(`SELECT count(*) FROM preview WHERE status='waiting' OR status='during'`, (err, rows) => {
      template = fs.readFileSync(path.join(__dirname, "/web/preview.mustache"), "utf8")

      var render_object = {
        "waiting_list": rows[0]["count(*)"],
        "keeping_time": config.keeping_time,
        "csrfToken": req.csrfToken
      }
    
      res.setHeader("content-type", "text/html");
      res.send(mustache.render(template, render_object))
    })
  } else {
    if (req.session.logged != undefined) {
      db.all(`SELECT count(*) FROM preview WHERE status='waiting' OR status='during'`, (err, rows) => {
        template = fs.readFileSync(path.join(__dirname, "/web/preview.mustache"), "utf8")
  
        var render_object = {
          "waiting_list": rows[0]["count(*)"],
          "keeping_time": config.keeping_time,
          "csrfToken": req.csrfToken
        }
      
        res.setHeader("content-type", "text/html");
        res.send(mustache.render(template, render_object))
      })
    } else {
      res.redirect("/login?return=preview")
    }
  }
})

app.get("/custom", csrfProtection, (req, res) => {
  if (config.gen_pwd == "") {
    db.all(`SELECT count(*) FROM video WHERE status='waiting' OR status='during'`, (err, rows) => {
      template = fs.readFileSync(path.join(__dirname, "/web/custom.mustache"), "utf8")

      var render_object = {
        "waiting_list": rows[0]["count(*)"],
        "keeping_time": config.keeping_time,
        "csrfToken": req.csrfToken
      }
    
      res.setHeader("content-type", "text/html");
      res.send(mustache.render(template, render_object))
    })
  } else {
    if (req.session.logged != undefined) {
      db.all(`SELECT count(*) FROM video WHERE status='waiting' OR status='during'`, (err, rows) => {
        template = fs.readFileSync(path.join(__dirname, "/web/custom.mustache"), "utf8")
  
        var render_object = {
          "waiting_list": rows[0]["count(*)"],
          "keeping_time": config.keeping_time,
          "need_pass": config.gen_pwd!="",
          "csrfToken": req.csrfToken
        }
      
        res.setHeader("content-type", "text/html");
        res.send(mustache.render(template, render_object))
      })
    } else {
      res.redirect("/login?return=custom")
    }
  }
})

app.get("/", csrfProtection, (req, res) => {
  if (config.gen_pwd == "") {
    db.all(`SELECT count(*) FROM video WHERE status='waiting' OR status='during'`, (err, rows) => {
      template = fs.readFileSync(path.join(__dirname, "/web/index.mustache"), "utf8")
  
      var render_object = {
        "waiting_list": rows[0]["count(*)"],
        "keeping_time": config.keeping_time,
        "need_pass": config.gen_pwd!="",
        "csrfToken": req.csrfToken
      }
    
      res.setHeader("content-type", "text/html");
      res.send(mustache.render(template, render_object))
    })
  } else {
    if (req.session.logged != undefined) {
      db.all(`SELECT count(*) FROM video WHERE status='waiting' OR status='during'`, (err, rows) => {
        template = fs.readFileSync(path.join(__dirname, "/web/index.mustache"), "utf8")
    
        var render_object = {
          "waiting_list": rows[0]["count(*)"],
          "keeping_time": config.keeping_time,
          "need_pass": config.gen_pwd!="",
          "csrfToken": req.csrfToken
        }
      
        res.setHeader("content-type", "text/html");
        res.send(mustache.render(template, render_object))
      })
    } else {
      res.redirect("/login")
    }
  }

})

app.get("/download/preview/:id", (req, res) => {
  if (req.query.token != undefined) {
    db.all(`SELECT * FROM preview WHERE id='${req.params.id}'`, (err, rows) => {
      if (rows.length >= 1) {
        if (req.query.token != rows[0].access_token) {
          res.status(403).send("Vous n'avez pas accès à cette preview")
        } else {
          if (rows[0].status == 'finished') {
            res.download(path.join(pathEvalute(config.export_folder), `preview_${rows[0].id}.mp4`), `youpod_preview_${rows[0].end_timestamp}.mp4`)
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

app.get("/download/:id", (req, res) => {
  if (req.query.token != undefined) {
    db.all(`SELECT * FROM video WHERE id='${req.params.id}'`, (err, rows) => {
      if (rows.length >= 1) {
        if (req.query.token != rows[0].access_token) {
          res.status(403).send("Vous n'avez pas accès à cette vidéo")
        } else {
          if (rows[0].status == 'finished') {
            res.download(path.join(pathEvalute(config.export_folder), `output_${rows[0].id}.mp4`), `youpod_${rows[0].end_timestamp}.mp4`)
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

app.post("/addvideo", csrfProtection, (req, res) => {
  if (config.gen_pwd == "") {
    if (req.body.email != undefined && req.body.rss != undefined) {
      if (req.body.selectEp == undefined) {
        getLastGuid(req.body.rss, (guid)=> {
          db.run(`INSERT INTO video(email, rss, guid, template, access_token, font) VALUES ("${req.body.email}", "${req.body.rss}", "${guid}", ?, "${randtoken.generate(32)}", ?)`, req.body.template, req.body["font-choice"])
          initNewGeneration();
          res.sendFile(path.join(__dirname, "/web/done.html"))
        })
      } else {
        db.run(`INSERT INTO video(email, rss, guid, template, access_token, font) VALUES ("${req.body.email}", "${req.body.rss}", "${req.body.selectEp}", ?, "${randtoken.generate(32)}", ?)`, req.body.template, req.body["font-choice"])
        initNewGeneration();
        res.sendFile(path.join(__dirname, "/web/done.html"))
      }
    } else {
      res.status(400).send("Votre requète n'est pas complète...")
    }
  } else {
    if (req.session.logged != undefined) {
      if (req.body.email != undefined && req.body.rss != undefined) {
        if (req.body.selectEp == undefined) {
          getLastGuid(req.body.rss, (guid)=> {
            db.run(`INSERT INTO video(email, rss, guid, template, access_token, font) VALUES ("${req.body.email}", "${req.body.rss}", "${guid}", ?, "${randtoken.generate(32)}", ?)`, req.body.template, req.body["font-choice"])
            initNewGeneration();
            res.sendFile(path.join(__dirname, "/web/done.html"))
          })
        } else {
          db.run(`INSERT INTO video(email, rss, guid, template, access_token, font) VALUES ("${req.body.email}", "${req.body.rss}", "${req.body.selectEp}", ?, "${randtoken.generate(32)}", ?)`, req.body.template, req.body["font-choice"])
          initNewGeneration();
          res.sendFile(path.join(__dirname, "/web/done.html"))
        }


      } else {
        res.status(400).send("Votre requète n'est pas complète...")
      }
    } else {
      res.redirect("/login")
    }
  }
})

function getLastGuid(feed_url, __callback) {
  parser.parseURL(feed_url, (err, feed) => {
    __callback(feed.items[0].guid)
    
  })
}

app.post("/addvideocustom", csrfProtection, (req, res) => {
  if (config.gen_pwd == "") {
    if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
        db.run(`INSERT INTO video(email, rss, template, access_token, epTitle, epImg, podTitle, podSub, audioURL) VALUES ("${req.body.email}", "__custom__", ?, "${randtoken.generate(32)}", ?, ?, ?, ?, ?)`, [req.body.template, req.body.epTitle, req.body.imgURL, req.body.podTitle, req.body.podSub, req.body.audioURL])    
      
        initNewGeneration();
        res.sendFile(path.join(__dirname, "/web/done.html"))  
    } else {
      res.status(400).send("Votre requète n'est pas complète...")
    }
  } else {
    if (req.session.logged != undefined) {
      if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
        db.run(`INSERT INTO video(email, rss, template, access_token, epTitle, epImg, podTitle, podSub, audioURL) VALUES ("${req.body.email}", "__custom__", ?, "${randtoken.generate(32)}", ?, ?, ?, ?, ?)`, [req.body.template, req.body.epTitle, req.body.imgURL, req.body.podTitle, req.body.podSub, req.body.audioURL])    
      
        initNewGeneration();
        res.sendFile(path.join(__dirname, "/web/done.html"))  
      } else {
        res.status(400).send("Votre requète n'est pas complète...")
      }
    } else {
      res.redirect("/login")
    }
  }

})

app.post("/addvideopreview", csrfProtection, (req, res) => {
  if (config.gen_pwd == "") {
    if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.audioURL != undefined && req.body.timestart != undefined) {
      if (req.body.color == undefined) {
        color = "blanc"
      } else {
        color = req.body.color
      }

      db.run(`INSERT INTO preview(email, access_token, epTitle, podTitle, imgLink, audioLink, startTime, color) VALUES ("${req.body.email}", "${randtoken.generate(32)}", ?, ?, ?, ?, ?, ?)`, [req.body.epTitle, req.body.podTitle, req.body.imgURL, req.body.audioURL, req.body.timestart, color])    
      
      initNewGeneration();
      res.sendFile(path.join(__dirname, "/web/done.html"))
    } else {
      res.status(400).send("Votre requète n'est pas complète...")
    }
  } else {
    if (req.session.logged != undefined) {
      if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.audioURL != undefined && req.body.timestart != undefined) {
        if (req.body.color == undefined) {
          color = "blanc"
        } else {
          color = req.body.color
        }
        
        db.run(`INSERT INTO preview(email, access_token, epTitle, podTitle, imgLink, audioLink, startTime, color) VALUES ("${req.body.email}", "${randtoken.generate(32)}", ?, ?, ?, ?, ?, ?)`, [req.body.epTitle, req.body.podTitle, req.body.imgURL, req.body.audioURL, req.body.timestart, color])    
        
        initNewGeneration();
        res.sendFile(path.join(__dirname, "/web/done.html"))
      } else {
        res.status(400).send("Votre requète n'est pas complète...")
      }
    } else {
      res.redirect("/login")
    }
  }


})

app.post("/api/video", (req, res) => {
  if (req.query.pwd != undefined && req.query.pwd == config.api_pwd) {
    if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
      
      db.run(`INSERT INTO video(email, rss, template, access_token, epTitle, epImg, podTitle, podSub, audioURL) VALUES ("${req.body.email}", "__custom__", ?, "${randtoken.generate(32)}", ?, ?, ?, ?, ?)`, [req.body.template, req.body.epTitle, req.body.imgURL, req.body.podTitle, req.body.podSub, req.body.audioURL], function(err) {
        if(err) {
            console.error(err);
            res.status(500);
            return;
        }
  
        db.each(`SELECT * FROM video WHERE id='${this.lastID}'`, (err, row) => {
          initNewGeneration();
          res.status(200).json({id: row.id, token: row.access_token});
        })
      });
    } else {
      res.status(400).send("Votre requète n'est pas complète...")
    }
  } else {
    res.status(401).send("Vous n'avez pas le bon mot de passe d'API")
  }
})

app.get("/api/video/:id", (req, res) => {
  if (req.query.pwd != undefined && req.query.pwd == config.api_pwd) {
    if (req.query.token != undefined) {
      db.all(`SELECT * FROM video WHERE id='${req.params.id}'`, (err, rows) => {
        if (rows.length > 0) {
          if (req.query.token == rows[0].access_token) {
            returnObj = {
              id: rows[0].id, 
              status: rows[0].status, 
              download_url: config.host + "/download/" + rows[0].id + "?token=" + rows[0].access_token
            }

            if (rows[0].status == "finished") {
              returnObj.delete_timestamp = parseInt(rows[0].end_timestamp) + (config.keeping_time * 60 * 60 * 1000) 
            }
            res.status(200).json(returnObj);
          } else {
            res.status(401).send("Le token n'est pas juste")
          }
        } else {
          res.status(404).send("Il n'y a pas de vidéo " + req.params.id)
        }
      })      
    } else {
      res.status(401).send("Vous devez préciser un token d'accès pour la vidéo")
    }
  } else {
    res.status(401).send("Vous n'avez pas le bon mot de passe d'API")
  }  
})

// FONCTION DE GENERATIONS
function restartGeneration() {
  console.log("Reprise de générations...")
  db.each(`SELECT * FROM video WHERE status='during'`, (err, row) => {
    if (row.rss != "__custom__") {
      generateFeed(row.rss, row.guid, row.template, row.id, row.font)
    } else {
      generateImgCustom(row.id);
    }
  })

  db.each(`SELECT * FROM preview WHERE status='during'`, (err, row) => {
      generateImgPreview(row.id);
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
          fs.unlinkSync(path.join(pathEvalute(config.export_folder), `output_${rows[i].id}.mp4`))
          db.run(`UPDATE video SET status='deleted' WHERE id=${rows[i].id}`);
          console.log("Flush video " + rows[i].id)
    
        }
      }
    }
  })

  db.all(`SELECT * FROM preview WHERE status='finished'`, (err, rows) => {
    if (rows.length >=1) {
      for (i = 0; i < rows.length; i++) {
        time = Date.now() - rows[i].end_timestamp
        time = time / (1000 * 60 * 60);
    
        if (time > config.keeping_time) {
          fs.unlinkSync(path.join(pathEvalute(config.export_folder), `preview_${rows[i].id}.mp4`))
          db.run(`UPDATE preview SET status='deleted' WHERE id=${rows[i].id}`);
          console.log("Flush preview " + rows[i].id)
    
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
            generateFeed(rows[0].rss, rows[0].guid, rows[0].template, rows[0].id, rows[0].font)
          } else {
            generateImgCustom(rows[0].id);
          }
        }
      })
    }
  })

  db.all(`SELECT count(*) FROM preview WHERE status='during'`, (err, rows) => {
    if (rows[0]["count(*)"] < config.max_during_preview) {
      db.all(`SELECT * FROM preview WHERE status='waiting'`, (err, rows) => {
        if(rows.length >= 1) {
          db.run(`UPDATE preview SET status='during' WHERE id=${rows[0].id}`);
          generateImgPreview(rows[0].id);
        }
      })
    }
  })
}

function generateImgPreview(id) {
  console.log("Preview " + id + " Démarage de la création");

  db.each(`SELECT * FROM preview WHERE id=${id}`, (err, row) => {
    var template = fs.readFileSync(path.join(__dirname, "/template/preview.mustache"), "utf8");

    var renderObj = {
      "imageURL": row.imgLink,
      "epTitle": row.epTitle,
      "podTitle": row.podTitle
    }

    string = mustache.render(template, renderObj);

    console.log("Preview " + id + " Génération de l'image");
    
    (async () => {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1000,
          height: 1000
        },
        headless: true,
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(string);
      await page.screenshot({path: path.join(__dirname, "/tmp/", `preview_${id}.png`), omitBackground: true});
    
      await browser.close();
      console.log("Preview " + id + " Image générée!")

      downloadAudioPreview(id, row.audioLink, row.startTime, row.color)
    })();
  })
}

function generateImgCustom(id) {
  console.log(id + " Démarage de la création");

  db.each(`SELECT * FROM video WHERE id=${id}`, (err, row) => {
    if (row.template != null && row.template != "") {
      template = row.template
    } else {
      var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");
    }

    var renderObj = {
      "imageURL": row.epImg,
      "epTitle": row.epTitle,
      "podTitle": row.podTitle,
      "podSub": row.podSub,
      "font": "Montserrat"
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

      downloadAudioCustom(id, row.audioURL, row.epTitle)
    })();
  })
}

function generateFeed(feed_url, guid, temp, id, font) {
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
      "podSub": feed.itunes.subtitle,
      "font_url": font.replace(/ /g, "+"),
      "font": font
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
      downloadAudio(id, feed.items[i].enclosure.url, feed.items[i].title)
    })();
  })
}

function downloadAudioPreview(id, audio_url, time, color) {
  console.log("Preview " + id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/preview_${id}.mp3`), data);
    console.log("Preview " + id + " Fichier téléchargé!");
    generateVideoPreview(id, time, color);
  });
}

function downloadAudioCustom(id, audio_url, ep_title) {
  console.log(id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
    console.log(id + " Fichier téléchargé!");
    generateVideo(id, ep_title);
  });
}

function downloadAudio(id, audio_url, ep_title) {
  console.log(id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
    console.log(id + " Fichier téléchargé!");
    generateVideo(id, ep_title);
  });
}

function generateVideoPreview(id, time, color) {
  console.log("Preview" + id + " Démarage de la génération de la vidéo")

  s = parseInt(time.split(":")[0] * 60) + parseInt(time.split(":")[1])

  var child = spawn("ffmpeg", ["-y", "-i", `./tmp/preview_${id}.png`, "-i", `./assets/${color}.mov`, "-filter_complex", 'overlay=0:0', "-ss", s, "-to", s + 20, "-i", `./tmp/preview_${id}.mp3`, "-shortest", "-acodec", "aac", `${config.export_folder}/preview_${id}.mp4`]);

  child.stdout.on('data', function (data) {
    console.log("Preview " +id + ' stdout: ' + data);
  });

  child.stderr.on('data', function (data) {
    console.log("Preview " + id + ' stderr: ' + data);
  });

  child.on('close', function (code) {
    console.log("Preview " + id + " Vidéo générée!")
    db.run(`UPDATE preview SET status='finished', end_timestamp='${Date.now()}' WHERE id=${id}`);
    fs.unlinkSync(path.join(__dirname, "/tmp/", `preview_${id}.png`))
    fs.unlinkSync(path.join(__dirname, "/tmp/", `preview_${id}.mp3`))

    sendMailPreview(id);
    initNewGeneration();
  });
}

function generateVideo(id, ep_title) {
  console.log(id + " Démarage de la génération de la vidéo")

  duration = Math.trunc(getMP3Duration(fs.readFileSync(path.join(__dirname, "tmp/", `audio_${id}.mp3`)))/1000) + 1

  var ol = spawn("ffmpeg", ["-y", "-loop", 1, "-i", `./tmp/overlay_${id}.png`, "-filter_complex", "overlay", "-vcodec", "libvpx-vp9", "-i", "./assets/loop.webm", "-t", 20, "-r", 60, "-ss", 0.1, `./tmp/loop_${id}.mp4`])
  
  ol.stdout.on('data', function (data) {
    console.log(id + ' stdout: ' + data);
  });

  ol.stderr.on('data', function (data) {
    console.log(id + ' stderr: ' + data);
  });

  ol.on('close', function (code) {
    var child = spawn("ffmpeg", ["-y", "-stream_loop", -1, "-i", `./tmp/loop_${id}.mp4`, "-i", `./tmp/audio_${id}.mp3`, "-c:v", "copy", "-c:a", "aac", "-shortest", "-map", "0:v", "-map", "1:a", `./${config.export_folder}/output_${id}.mp4`]);

    child.stdout.on('data', function (data) {
      console.log(id + ' stdout: ' + data);
    });
  
    child.stderr.on('data', function (data) {
      console.log(id + ' stderr: ' + data);
    });
  
    child.on('close', function (code) {
      console.log(id + " Vidéo générée!")
      db.run(`UPDATE video SET status='finished', end_timestamp='${Date.now()}' WHERE id=${id}`);
      fs.unlinkSync(path.join(__dirname, "/tmp/", `overlay_${id}.png`))
      fs.unlinkSync(path.join(__dirname, "/tmp/", `audio_${id}.mp3`))
      fs.unlinkSync(path.join(__dirname, "/tmp/", `loop_${id}.mp4`))
  
      sendMail(id, ep_title);
      initNewGeneration();
    });
  });


}

function sendMailPreview(id) {
  db.all(`SELECT * FROM preview WHERE id='${id}'`, (err, rows) => {

    template = fs.readFileSync(path.join(__dirname, "/web/mail_custom.mustache"), "utf8")
    renderObj = {
      "ep_title": rows[0].epTitle,
      "keeping_time": config.keeping_time,
      "video_link": config.host + "/download/preview/" + id + "?token=" + rows[0].access_token
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

    db.run(`UPDATE preview SET email='deleted' WHERE id=${id}`);
  })
}

function sendMail(id, ep_title) {
  db.all(`SELECT * FROM video WHERE id='${id}'`, (err, rows) => {

    if (rows[0].rss != "__custom__") {
      template = fs.readFileSync(path.join(__dirname, "/web/mail.mustache"), "utf8")
      renderObj = {
        "rss_link": rows[0].rss,
        "keeping_time": config.keeping_time,
        "epTitle": ep_title,
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

function pathEvalute(arg_path) {
	if (path.isAbsolute(arg_path)) {
		return arg_path
	} else {
		return path.join(__dirname, arg_path)
	}
}

//Ouverture du serveur Web sur le port définit dans config.json
app.listen(config.port, () => console.log(`Serveur lancé sur le port ${config.port}`))