# Notes de migration V1

## Décisions actées

1. Nomenclature publique : nom vernaculaire en priorité.
2. Espèces : `Da` et `Dr` dans la nouvelle application ; `Dcr` reste un alias legacy d'import.
3. Ciradienne : code canonique `CIRADH4X438`.
4. Couleur : échelle historique à cinq niveaux conservée.
5. Bug corrigé : les cinq notes de couleur ne sont plus concaténées aux cinq pondérations globales.
6. I1.2 : dépend désormais du calibre minimum et maximum choisi par l'utilisateur.
7. Rapport : ventilation du **poids** des tubercules en quatre parts mutuellement exclusives.

## À valider avant version finale

- Reproduire ou valider numériquement I5.1 par rapport au modèle événementiel R `drc` historique.
- Comparer plusieurs scénarios de référence R / JavaScript pour vérifier les classements après correction du bug couleur et modification de I1.2.
- Remplacer si besoin les 28 PDF historiques par les fiches variétales les plus récentes.
- Revoir les textes éditoriaux, logos et mentions institutionnelles de la future page publique.
