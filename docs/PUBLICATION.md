# Publication et vérifications

- `main` contient `app/`, la documentation et les tests. La branche de publication `gh-pages` contient le dossier `app/` à sa racine. GitHub Pages sert ces fichiers en HTTPS.
- Conserve l’URL d’installation, l’identifiant du manifeste et le nom de la base IndexedDB lors d’une mise à jour. Incrémente la version du cache dans `app/sw.js` dès qu’un fichier mis en cache change. Ferme les anciennes fenêtres de l’application pour laisser une mise à jour en attente s’activer.
- Publie uniquement les fichiers de `app/` sur la branche `gh-pages`. Les bases d’exploitation, sauvegardes et exports des boutiques restent en dehors du dépôt.
- Vérifie que la page d’accueil se charge, que le manifeste et le script de cache répondent, et que le message **Application prête hors connexion** s’affiche. Sur chaque téléphone, ouvre l’icône en mode avion après le premier lancement, puis relis une opération de test après fermeture. Utilise un appareil de test avant une saisie réelle.

Références officielles

- [Configurer la publication GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Installer une app web avec Safari sur iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
- [Installer une application web dans Chrome sur Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid)
- [Stockage persistant dans un navigateur](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
