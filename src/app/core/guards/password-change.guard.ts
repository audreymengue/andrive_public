import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CoreService } from '../services/core.service';

export const PasswordChangeGuard: CanActivateFn = () => {
  const coreService = inject(CoreService);
  const router = inject(Router);

  if (coreService.currentUser()?.mustChangePassword) {
    router.navigate(['/premiere-connexion']);
    return false;
  }
  return true;
};