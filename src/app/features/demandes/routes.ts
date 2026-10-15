import { Routes } from '@angular/router';

export const DEMANDES_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('../../layout/main-layout/main-layout').then(m => m.MainLayout),
        children: [
            {
                path: 'demande-sortie',
                title: 'DemandeSortie',
                loadComponent: () => import('./views/demande-sortie/demande-sortie.page').then(m => m.DemandeSortiePage)
            }
        ]
    }
];
