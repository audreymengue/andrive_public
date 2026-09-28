import { Routes } from '@angular/router';
import { GuestGuard } from '../../core/guards/guest.guard';

export const AUTH_ROUTES: Routes = [
    {
        path: 'login',
        title: 'Login',
        canActivate: [GuestGuard],
<<<<<<< HEAD
        loadComponent: () => import('./views/login/login.page').then(m => m.LoginPage)
=======
        title: 'Connexion'
    },
    {
        path: 'reinitialisation-mot-de-passe',
        loadComponent: () => import('./views/reset-password.page').then(m => m.ResetPasswordPage),
        title: 'Réinitialisation du mot de passe'
>>>>>>> origin/main
    }
];