# Bya Service Mobile

Application de gestion de boutique installable depuis le navigateur. Chaque appareil garde son propre catalogue, son stock, ses contacts et son historique. L’application utilise un stockage local IndexedDB.

**Adresse d’installation** · [Bya Service Mobile](https://ousseynou-faye.github.io/bya-service-mobile/)

## Installer sur un téléphone

1. Ouvre l’adresse avec Internet et attends le message **Application prête hors connexion**.
2. Sur iPhone, utilise Safari → **Partager** → **Sur l’écran d’accueil**. Active **Ouvrir comme app web** si Safari affiche cette option. Sur Samsung, utilise Chrome → **⋮** → **Ajouter à l’écran d’accueil** → **Installer**.
3. Ouvre l’icône Bya Service une première fois avec Internet. Attends à nouveau **Application prête hors connexion**, puis commence à enregistrer tes données depuis cette icône.

## Données et sauvegardes

- Chaque nouvelle installation démarre avec une boutique vide. Les bases du PC et des deux téléphones sont indépendantes et leur stock évolue selon les saisies de chaque appareil.
- Dans **Paramètres**, utilise **Télécharger la sauvegarde** pour conserver une copie `.json` ailleurs. Elle contient les données de la boutique. Le navigateur et le système peuvent supprimer le stockage si tu effaces les données du site ou désinstalles l’application.
- **Restaurer une copie** charge une sauvegarde mobile et remplace les données de l’appareil. La copie précédente reste accessible via **Copie avant restauration**.

## Dossiers

| Emplacement | Contenu |
| --- | --- |
| `app/` | Site installable et fichiers nécessaires à son ouverture hors connexion |
| `app/ui/` | Interface de caisse, catalogue, stock, contacts et finances |
| `app/src/` | Règles métier, stockage local et exports |
| `app/assets/` | Icônes et illustration de l’accueil |
| `docs/` | Publication et vérifications |
| `tests/` | Vérifications locales automatisées |

## Développement

Depuis le dossier du dépôt, lance `node --test` avec Node.js récent. Pour tester la version web en local, lance `python -m http.server 8780 --directory app` puis ouvre [l’adresse locale](http://127.0.0.1:8780/).

Le dépôt distribue les fichiers statiques de l’application. Les données saisies et les sauvegardes sont gérées par l’appareil.
