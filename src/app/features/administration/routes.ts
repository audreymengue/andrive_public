import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';

export const ADMINISTRATION_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('../../layout/main-layout/main-layout').then(m => m.MainLayout),
        
        children: [
            {
                path: 'list-permission',
                title: 'ListPermission',
                loadComponent: () => import('./views/list-permission/list-permission.page').then(m => m.ListPermissionPage)
            },
            {
                path: 'list-role',
                title: 'ListRole',
                loadComponent: () => import('./views/list-role/list-role.page').then(m => m.ListRolePage)
            },
            // Route optionnelle si vous préférez passer par une URL dynamique pour les permissions d'un rôle
            {
                path: 'list-role/:id/permissions',
                title: 'Permissions du rôle',
                loadComponent: () => import('./views/list-permission/list-permission.page').then(m => m.ListPermissionPage)
            },
            {
                path: 'list-users',
                title: 'ListUsers',
                loadComponent: () => import('./views/list-users/list-users.page').then(m => m.ListUsersPage)
            },
            {
                path: 'list-users/new',
                title: 'Nouvel utilisateur',
                data: { mode: 'create' },
                loadComponent: () => import('./views/user-form/user-form.page').then(m => m.UserFormPage)
            },
            {
                path: 'list-users/:id/edit',
                title: "Modifier l'utilisateur",
                data: { mode: 'edit' },
                loadComponent: () => import('./views/user-form/user-form.page').then(m => m.UserFormPage)
            },
            {
                path: 'list-users/:id',
                title: "Détail de l'utilisateur",
                data: { mode: 'detail' },
                loadComponent: () => import('./views/user-form/user-form.page').then(m => m.UserFormPage)
            }
        ]
    }
];