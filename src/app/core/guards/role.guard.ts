import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CoreService } from '../services/core.service';

/** Bloque une route si le profil connecté ne fait pas partie des profils autorisés. */
export const RoleGuard: CanActivateFn = (route) => {
  const coreService = inject(CoreService);
  const router = inject(Router);
  const allowedRoles = route.data?.['roles'] as string[] | undefined;

  if (!allowedRoles?.length || allowedRoles.some(role => coreService.hasRole(role))) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
