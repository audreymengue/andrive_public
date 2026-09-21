# Administration Module

## Description
Module Administration - Description à compléter
- **Guard**: AuthGuard

## Structure
```
administration/
├── components/     # Composants réutilisables du module
├── views/          # Pages/vues du module
├── models/         # Interfaces et types
├── services/       # Services spécifiques à la feature
└── routes.ts       # Configuration des routes (lazy loading)
```

## Routes
- `/administration` - Route principale (lazy loaded)

## Commandes utiles
```bash
# Créer une page
npm run g:page

# Créer un composant
npm run g:component

# Créer un modèle
npm run g:model
```
