import { Routes } from '@angular/router';
import { GuestGuard } from '../../core/guards/guest.guard';

export const AUTH_ROUTES: Routes = [
    {
        path: 'login',
        title: 'Login',
        canActivate: [GuestGuard],
        loadComponent: () => import('./views/login/login.page').then(m => m.LoginPage)
    }
];