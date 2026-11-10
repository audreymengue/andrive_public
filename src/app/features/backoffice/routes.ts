import { Routes } from '@angular/router';
import { RoleGuard } from '../../core/guards/role.guard';

export const BACKOFFICE_ROUTES: Routes = [
  {
    path: 'gestion/demandes',
    loadComponent: () => import('./views/traitement-demandes/traitement-demandes.page').then((module) => module.TraitementDemandesPage),
    canActivate: [RoleGuard],
    data: {
      roles: ['dag', 'super_admin'],
      title: 'Traitement des demandes',
      description: 'Consultez les demandes en attente et préparez les courses.',
    },
  },
  {
    path: 'gestion/chauffeurs',
    loadComponent: () => import('./views/chauffeurs/chauffeurs.page').then((module) => module.ChauffeursPage),
    canActivate: [RoleGuard],
    data: {
      roles: ['dag', 'super_admin'],
      title: 'Registre des chauffeurs',
      description: 'Gérez les informations et la disponibilité des chauffeurs.',
    },
  },
  {
    path: 'gestion/parc-automobile',
    loadComponent: () => import('./views/vehicules/vehicules.page').then((module) => module.VehiculesPage),
    canActivate: [RoleGuard],
    data: { roles: ['dag', 'super_admin'], title: 'Parc automobile', description: 'Gérez les véhicules du parc automobile.' },
  },
  {
    path: 'gestion/alertes',
    loadComponent: () => import('./views/section.page').then((module) => module.SectionPage),
    canActivate: [RoleGuard],
    data: { roles: ['dag', 'super_admin'], title: 'Alertes', description: 'Suivez les alertes liées aux chauffeurs et aux véhicules.' },
  },
  {
    path: 'missions/planifiees',
    loadComponent: () => import('./views/section.page').then((module) => module.SectionPage),
    canActivate: [RoleGuard],
    data: { roles: ['pool_chauffeur', 'super_admin'], title: 'Missions planifiées', description: 'Consultez les missions qui vous sont affectées.' },
  },
  {
    path: 'missions/historique',
    loadComponent: () => import('./views/section.page').then((module) => module.SectionPage),
    canActivate: [RoleGuard],
    data: { roles: ['pool_chauffeur', 'super_admin'], title: 'Historique des missions', description: 'Consultez les missions terminées.' },
  },
  {
    path: 'missions/signalement',
    loadComponent: () => import('./views/section.page').then((module) => module.SectionPage),
    canActivate: [RoleGuard],
    data: { roles: ['pool_chauffeur', 'super_admin'], title: 'Signalement', description: 'Signalez un incident ou une anomalie.' },
  },
];
