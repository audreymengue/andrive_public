import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'administration/**', renderMode: RenderMode.Client },
  { path: 'dashboard/gestion/demandes', renderMode: RenderMode.Client },
  { path: 'dashboard/gestion/courses/:id', renderMode: RenderMode.Client },
  { path: 'dashboard/demandes/:id', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender }
];
