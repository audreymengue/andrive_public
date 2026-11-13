import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Paginated, User } from '../../administration/models/user.model';
import { UserService } from '../../administration/services/user.service';

export type ProfilChauffeur = User;
export type StatutProfilChauffeur = 'ACTIF' | 'INACTIF';

@Injectable({ providedIn: 'root' })
export class ChauffeurService {
  private readonly users = inject(UserService);

  list(options: {
    search?: string;
    statut?: StatutProfilChauffeur;
    page?: number;
    perPage?: number;
  } = {}): Observable<Paginated<ProfilChauffeur>> {
    return this.users.list({ ...options, role: 'chauffeur' });
  }
}
