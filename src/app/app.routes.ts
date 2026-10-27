import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { PasswordChangeGuard } from './core/guards/password-change.guard';

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
    path: 'premiere-connexion',
    loadComponent: () => import('./features/auth/views/first-connexion/first-connexion.page').then(m => m.FirstConnexionPage),
    canActivate: [AuthGuard],
    title: 'Première connexion'
},
    {
    path: 'reset-password',
    loadComponent: () =>
    import('./features/auth/views/reset-password.page') .then(m => m.ResetPasswordPage),
    canActivate: [AuthGuard],
    title: 'Renouveler mon mot de passe'
},
    {
        path: 'dashboard',
        loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayout),
        canActivate: [AuthGuard, PasswordChangeGuard],
        children: [
            {
                path: '',
                pathMatch: 'full',
                loadComponent: () => import('./features/dashboard/views/dashboard.page').then(m => m.DashboardPage),
                title: 'Tableau de bord'
            },
            {
                path: 'demandes/transport',
                loadComponent: () => import('./features/demandes/views/demande-sortie/demande-sortie.page') .then(m => m.DemandeSortiePage),
                canActivate: [RoleGuard],
                data: {roles: ['agent', 'demandeur', 'super_admin'],title: 'Demande de transport',description: 'Créez et envoyez une demande de transport.'
    }
},
            {
                path: 'demandes/historique',
                loadComponent: () => import('./features/demandes/views/historique-demandes/historique-demandes.page').then(m => m.HistoriqueDemandesPage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'demandeur', 'super_admin'], title: 'Historique des demandes' }
            },
            {
                path: 'demandes/suivi',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'demandeur', 'super_admin'], title: 'Suivi des demandes', description: 'Consultez le statut de vos demandes de transport.' }
            },
            {
                path: 'demandes/:id',
                loadComponent: () => import('./features/demandes/views/detail-demande/detail-demande.page').then(m => m.DetailDemandePage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'demandeur', 'super_admin'], title: 'Détail de la demande' }
            },
            {
                path: 'gestion/demandes',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'super_admin'], title: 'Traitement des demandes', description: 'Examinez, validez ou planifiez les demandes de transport.' }
            },
            {
                path: 'gestion/chauffeurs',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'super_admin'], title: 'Registre des chauffeurs', description: 'Gérez les informations et la disponibilité des chauffeurs.' }
            },
            {
                path: 'gestion/parc-automobile',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'super_admin'], title: 'Parc automobile', description: 'Gérez les véhicules du parc automobile.' }
            },
            {
                path: 'gestion/alertes',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['dag', 'super_admin'], title: 'Alertes', description: 'Suivez les alertes liées aux chauffeurs et aux véhicules.' }
            },
            {
                path: 'missions/planifiees',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['pool_chauffeur', 'super_admin'], title: 'Missions planifiées', description: 'Consultez les missions qui vous sont affectées.' }
            },
            {
                path: 'missions/historique',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['pool_chauffeur', 'super_admin'], title: 'Historique des missions', description: 'Consultez les missions terminées.' }
            },
            {
                path: 'missions/signalement',
                loadComponent: () => import('./features/backoffice/views/section.page').then(m => m.SectionPage),
                canActivate: [RoleGuard],
                data: { roles: ['pool_chauffeur', 'super_admin'], title: 'Signalement', description: 'Signalez un incident ou une anomalie.' }
            }
        ]
    },
    
    {
        path: 'administration',
        canActivate: [AuthGuard, PasswordChangeGuard, RoleGuard],
        data: { roles: ['super_admin'] },
        loadChildren: () => import('./features/administration/routes').then(m => m.ADMINISTRATION_ROUTES)
    },
{
        path: '**',
        title: 'Page introuvable',
        redirectTo: ''
    }
];
