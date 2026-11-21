import { Routes } from '@angular/router';
import { RoleGuard } from '../../core/guards/role.guard';

export const BACKOFFICE_ROUTES: Routes = [
  {
    path: 'gestion/demandes/historique',
    loadComponent: () => import('./views/traitement-historique/traitement-historique.page').then((module) => module.TraitementHistoriquePage),
    canActivate: [RoleGuard],
    data: {
      roles: ['dag', 'super_admin'],
      title: 'Historique des demandes traitées',
      description: 'Consultez les demandes validées, refusées et annulées.',
    },
  },
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
    path: 'gestion/courses/brouillons',
    loadComponent: () => import('./views/course-drafts/course-drafts.page').then((module) => module.CourseDraftsPage),
    canActivate: [RoleGuard],
    data: {
      roles: ['dag', 'super_admin'],
      title: 'Brouillons de courses',
      description: 'Consultez et modifiez les préparations avant leur validation.',
    },
  },
  {
    path: 'gestion/courses/nouvelle',
    loadComponent: () => import('./views/course-preparation/course-preparation.page').then((module) => module.CoursePreparationPage),
    canActivate: [RoleGuard],
    data: {
      roles: ['dag', 'super_admin'],
      title: 'Préparer une course',
      description: 'Affectez un chauffeur, un véhicule et définissez l’itinéraire prévu.',
    },
  },
  {
    path: 'gestion/courses/:id',
    loadComponent: () => import('./views/course-preparation/course-detail.page').then((module) => module.CourseDetailPage),
    canActivate: [RoleGuard],
    data: {
      roles: ['dag', 'super_admin'],
      title: 'Détail de la course',
      description: 'Consultez la préparation enregistrée et les détails de la demande.',
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
    loadComponent: () => import('./views/alertes/alertes.page').then((module) => module.AlertesPage),
    canActivate: [RoleGuard],
    data: { roles: ['dag', 'super_admin'], title: 'Alertes', description: 'Suivez les alertes liées aux chauffeurs et aux véhicules.' },
  },
  {
    path: 'missions/planifiees',
    loadComponent: () => import('./views/missions/missions.page').then((module) => module.MissionsPage),
    canActivate: [RoleGuard],
    data: { roles: ['chauffeur', 'pool_chauffeur', 'super_admin'], missionStatus: 'planned', title: 'Missions planifiées', description: 'Consultez les courses qui vous sont affectées.' },
  },
  {
    path: 'missions/historique',
    loadComponent: () => import('./views/missions/missions.page').then((module) => module.MissionsPage),
    canActivate: [RoleGuard],
    data: { roles: ['chauffeur', 'pool_chauffeur', 'super_admin'], missionStatus: 'history', title: 'Historique des missions', description: 'Consultez les courses terminées.' },
  },
  {
    path: 'missions/signalement',
    loadComponent: () => import('./views/transport/transport.page').then((module) => module.TransportPage),
    canActivate: [RoleGuard],
    data: { roles: ['chauffeur', 'pool_chauffeur', 'super_admin'], title: 'Signalement', description: 'Signalez un incident ou une anomalie.' },
  },
  {
    path: 'missions/:id',
    loadComponent: () => import('./views/missions/mission-detail.page').then((module) => module.MissionDetailPage),
    canActivate: [RoleGuard],
    data: { roles: ['chauffeur', 'pool_chauffeur', 'super_admin'], title: 'Détail de la course', description: 'Consultez et mettez à jour votre course affectée.' },
  },
];
