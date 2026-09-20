import { Routes } from '@angular/router';
import { GuestGuard } from '../../core/guards/guest.guard';

export const AUTH_ROUTES: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./views/login.page').then(m => m.LoginPage),
        canActivate: [GuestGuard],
        title: 'Connexion'
    },
    {
        path: 'reinitialisation-mot-de-passe',
        loadComponent: () => import('./views/reset-password.page').then(m => m.ResetPasswordPage),
        title: 'Réinitialisation du mot de passe'
    }
];