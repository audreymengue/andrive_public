import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { PasswordChangeGuard } from './core/guards/password-change.guard';
import { CoreService } from './core/services/core.service';
import { BACKOFFICE_ROUTES } from './features/backoffice/routes';

const redirectChauffeurToMissions: CanActivateFn = () => {
    const coreService = inject(CoreService);
    const router = inject(Router);

    return coreService.hasRole('chauffeur') || coreService.hasRole('pool_chauffeur')
        ? router.createUrlTree(['/dashboard/missions/planifiees'])
        : true;
};

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
                canActivate: [redirectChauffeurToMissions],
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
                loadComponent: () => import('./features/demandes/views/historique-demandes/historique-demandes.page').then(m => m.HistoriqueDemandesPage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'demandeur', 'super_admin'], title: 'Suivi de mes demandes', description: 'Consultez le statut et les détails de vos demandes de transport.' }
            },
            {
                path: 'demandes/:id',
                loadComponent: () => import('./features/demandes/views/detail-demande/detail-demande.page').then(m => m.DetailDemandePage),
                canActivate: [RoleGuard],
                data: { roles: ['agent', 'demandeur', 'dag', 'super_admin'], title: 'Détail de la demande' }
            },
            ...BACKOFFICE_ROUTES
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
