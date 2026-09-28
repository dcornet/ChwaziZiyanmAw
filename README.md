# VaPaDONF — réimplémentation statique V1

Cette version remplace l'application R/Shiny par une page HTML/CSS/JavaScript autonome, conçue pour GitHub Pages.

## Fonctionnalités incluses

- 28 génotypes canoniques : 21 `Da` (*Dioscorea alata*) + 7 `Dr` (*D. rotundata*).
- Sélection des zones Basse-Terre / Grande-Terre + Marie-Galante.
- Sélection d'une ou deux espèces.
- Pondération historique des 5 grands critères.
- Préférences historiques de couleur sur 5 niveaux.
- Correction du bug historique de concaténation : les 5 préférences de couleur ne pondèrent plus I1 à I5 ; elles agissent uniquement sur I4.1.
- Calibre minimum / maximum saisi **avant le classement** et utilisé dans I1.2.
- Classement normalisé sur 10.
- Comparaison variété améliorée / variété témoin.
- Camembert de ventilation du poids : commercialisables / défauts / trop petits / trop gros.
- Rapport imprimable ; le bouton **Créer le rapport PDF** ouvre la boîte d'impression du navigateur, où l'utilisateur choisit « Enregistrer au format PDF ».
- 28 fiches variétales historiques incluses et téléchargeables sous la nomenclature canonique.

## Définition de I1.2 dans cette V1

Un tubercule est commercialisable s'il :

1. ne porte aucun défaut dans `Defaut1`, `Defaut2` ou `Defaut3` ;
2. pèse au moins le minimum choisi par l'utilisateur ;
3. ne dépasse pas le maximum choisi par l'utilisateur.

Le rendement commercialisable est recalculé par situation avec la même formule agronomique que le code R historique :

`poids commercialisable / nombre de plants récoltés × densité / 100`.

Pour le camembert, les catégories sont rendues mutuellement exclusives afin de sommer à 100 % :

- les tubercules avec défaut sont d'abord classés dans **Défauts**, quelle que soit leur taille ;
- parmi les tubercules sans défaut : **Trop petits**, **Commercialisables** ou **Trop gros** selon le calibre utilisateur.

Cette priorité n'affecte pas I1.2 : tout tubercule de l'une des trois catégories non commercialisables est exclu du poids commercialisable.

## Portage scientifique

Les sous-indicateurs I1 à I4 suivent le code historique et les données de la sauvegarde, avec les corrections de nomenclature déjà identifiées.

- `I1.4` est recalculé après filtrage des zones, comme dans le comportement R.
- `I4.1` applique la préférence utilisateur à la couleur connue de chaque génotype.
- `I5.2` et `I5.3` sont pré-calculés avec une logistique à trois paramètres de même forme que le modèle `L.3` historique.
- **Limite V1 : `I5.1`** utilise pour l'instant la durée empirique q10–q90 des levées plutôt que la vraisemblance événementielle exacte de `drc::L.3(type="event")`. Ce point est affiché dans l'interface et le rapport et doit faire l'objet d'une validation avant une version scientifique figée.

Le dossier `reference-r/` contient uniquement les scripts R utiles pour conserver la traçabilité du portage, sans l'ancien portail ni ses autres modules.

## Organisation

```text
.
├── index.html
├── assets/
│   ├── app.js
│   └── style.css
├── data/
│   ├── genotypes.json
│   ├── genotypes.js
│   ├── model-data.json
│   └── model-data.js
├── fiches-varietales/       # 28 PDF
├── images/
│   ├── colors/
│   └── tubers/              # miniatures web compressées
├── reference-r/             # scripts scientifiques historiques utiles
├── tools/
│   └── build_data.py
└── .github/workflows/pages.yml
```

Les fichiers `.js` du dossier `data/` sont des enveloppes des JSON permettant à la page de fonctionner sans serveur de données. Les JSON restent disponibles pour l'audit et les traitements externes.

## Tester localement

La page peut généralement être ouverte directement en double-cliquant sur `index.html`.

Si le navigateur applique des restrictions aux fichiers locaux, depuis le dossier du projet :

```bash
python -m http.server 8000
```

puis ouvrir `http://localhost:8000`.

## Publier sur GitHub Pages

1. Créer un dépôt GitHub vide.
2. Copier le contenu de ce dossier à la racine du dépôt.
3. Commit + push sur `main`.
4. Dans **Settings → Pages**, choisir **GitHub Actions** comme source si nécessaire.
5. Le workflow `.github/workflows/pages.yml` publie le site.

Aucun serveur R, Node ou base de données n'est requis à l'exécution.

## Remplacer les fiches par les versions récentes

Les 28 PDF inclus proviennent de la sauvegarde historique. Si les fiches récentes présentes sur le poste local doivent les remplacer, conserver exactement les noms indiqués dans `data/genotypes.json` (`fiche_pdf`).

Cas particulier retenu :

`Ciradienne_Da_CIRADH4X438.pdf`

Le code `CIRADH4X438` est celui utilisé par le référentiel et les données historiques.

## Régénérer les données statiques

`tools/build_data.py` nécessite Python avec `pandas`, `numpy` et `scipy` et prend en entrée le dossier historique `data_rita`.

Exemple :

```bash
python tools/build_data.py \
  --source /chemin/vers/data_rita \
  --mapping data/genotypes.json \
  --output data/model-data.json
```

Après régénération, `data/model-data.js` doit être remis en cohérence avec le JSON. Le fichier livré dans ce ZIP est déjà généré.


## Notes v8
- Corrections Florilège / OLGA appliquées selon les dernières indications utilisateur.
- Pour supprimer les en-têtes et pieds de page du navigateur dans le PDF, décocher l’option correspondante dans la boîte d’impression : ce comportement n’est pas pilotable de façon fiable en HTML/CSS standard.
