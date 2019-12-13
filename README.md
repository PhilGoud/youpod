# YouPod

Pour commencer à programmer YouPod, nous sommes partis d'un constat : 
Il est difficile pour un néophyte d'exporter simplement son podcast en vidéo. 

S'il est possible d'utiliser les logiciels de montages classiques, il faut reconnaître que le réaliser "à la main", c'est long... 
Il existe des utilitaires en ligne, ou des hébergeurs de podcasts qui le proposent directement dans leurs offres (comme [Ausha](https://www.ausha.co/), ou [Acast Open](https://open.acast.com/)) mais tous sont payants.

En réalité, ce n'est pas très compliqué : Il suffit de prendre l'audio, et une image non? 

On a quand même ajouté une petite boucle vidéo derrière pour que ça ressemble un peu plus à quelque chose. 

Et c'est à partir de [ce tuto d'Alliés Numériques](https://alliesnumeriques.org/tutoriels/publier-votre-podcast-sur-youtube-la-methode-classe-avec-ffmpeg/) écrit par Phil, que la première version est née...


## Installation

Pour avoir votre propre instance de Youpod c'est simple : Il vous faudra simplement [NodeJS](https://nodejs.org/en/) (en version LTS). 
Une fois NodeJS installé, téléchargez le code, et installez les modules. 

Il est nécéssaire aussi d'avoir FFMPEG 4.2.x minimum. Verifiez en tapant dans un terminal
```ffmpeg -version```
Si ce n'est pas le cas, téléchargez-le ici : https://www.ffmpeg.org/download.html

Voici les commandes pour faire ça :
```shell
git clone https://github.com/Bigaston/youpod
cd youpod
npm install
```

(Sur Windows la commande cd ne marchera pas, rendez vous simplement dans le dossier téléchargé, cliquez sur la barre d'adresse, écrivez `cmd` et vous aurez un terminal dans le bon dossier pour lancer `npm install`)

Ensuite il est très important de se rendre dans le fichier `/youpod/config.json` ainsi généré, qui contiendra les informations essentielles à l'installation de votre site web.

```JSON
{
    "port": 5674, //Le port de votre serveur
    "max_during": 1, //Le nombre de vidéos qui seront rendus en même temps
    "max_during_preview": 1, //Le nombre de preview pour les réseaux sociaux qui seront rendus en même temps
    "keeping_time": 12, //La durée au bout de laquelle les vidéos seront supprimés (en heure)
    "host": "http://localhost:5674", //L'adresse à laquelle on pourra accèder à votre site
    "mail": "machin@gmail.com", //L'adresse email de votre bot
    "password": "123456", //Le mot de passe du compte Gmail de votre bot
    "export_folder": "./video", //Le dossier où seront sauvegardés les vidéos
    "gen_pwd": "123456", //Le mot de passe pour accèder au site (vide pour désactiver)
    "api_pwd": "123456", //Le mot de passe d'accès à l'API
    "cookie_secret": "IDK" //Le mot de passe secret pour les cookies
}
```

Pour plus d'information à propos de comment configurer votre compte email, allez voir dans [cet article du Wiki](https://github.com/Bigaston/youpod/wiki/Configurer-son-compte-mail) !

Maintenant il ne vous reste plus qu'à lancer votre serveur avec

```shell
npm start
```

Et vous pourrez y accéder directement via un navigateur à l'adresse que vous avez configurée (par défaut, http://localhost:5674).

## Remerciement

Merci beaucoup à [Phil_Goud](https://twitter.com/Phil_Goud) qui m'a beaucoup aidé sur ce projet grâce entre autre aux vagues qu'il a généré et à toute l'interface qu'il a faite (vu que la mienne était un peu... bof?)

Si vous souhaitez me soutenir financièrement dans ce projet, vous pouvez passer par mon [Patreon](https://patreon.com/Bigaston) ou mon [uTip](https://utip.io/Bigaston) !

En cas de problème ou de questions, passez directement par les [Issues](https://github.com/Bigaston/youpod/issues) ou par [mon Twitter](https://twitter.com/Bigaston) !
