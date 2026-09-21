import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login'
    },
    {
        path: '',
        loadChildren: () => import('./features/auth/routes').then(m => m.AUTH_ROUTES)
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayout),
        canActivate: [AuthGuard],
        children: [
            {
                path: '',
                pathMatch: 'full',
                loadComponent: () => import('./features/dashboard/views/dashboard.page').then(m => m.DashboardPage),
                title: 'Tableau de bord'
            },
            {
                path: 'demandes/transport',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'administrateur'], title: 'Demande de transport', description: 'Créez et envoyez une demande de transport.' }
            },
            {
                path: 'demandes/suivi',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'administrateur'], title: 'Suivi des demandes', description: 'Consultez le statut de vos demandes de transport.' }
            },
            {
                path: 'gestion/demandes',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'administrateur'], title: 'Traitement des demandes', description: 'Examinez, validez ou planifiez les demandes de transport.' }
            },
            {
                path: 'gestion/chauffeurs',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'administrateur'], title: 'Registre des chauffeurs', description: 'Gérez les informations et la disponibilité des chauffeurs.' }
            },
            {
                path: 'gestion/parc-automobile',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'administrateur'], title: 'Parc automobile', description: 'Gérez les véhicules du parc automobile.' }
            },
            {
                path: 'gestion/alertes',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'administrateur'], title: 'Alertes', description: 'Suivez les alertes liées aux chauffeurs et aux véhicules.' }
            },
            {
                path: 'missions/planifiees',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['pool_chauffeur', 'administrateur'], title: 'Missions planifiées', description: 'Consultez les missions qui vous sont affectées.' }
            },
            {
                path: 'missions/historique',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['pool_chauffeur', 'administrateur'], title: 'Historique des missions', description: 'Consultez les missions terminées.' }
            },
            {
                path: 'missions/signalement',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['pool_chauffeur', 'administrateur'], title: 'Signalement', description: 'Signalez un incident ou une anomalie.' }
            }
        ]
    },
    
    {
        path: 'administration',
        loadChildren: () => import('./features/administration/routes').then(m => m.ADMINISTRATION_ROUTES)
    },
{
        path: '**',
        title: 'Page introuvable',
        redirectTo: ''
    }
];
