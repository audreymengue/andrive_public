import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { Role } from '../models/user.model';

export const MOCK_ROLES: Role[] = [
  { id: 1, nom: 'super_admin', description: "Administrateur principal de l'application", statut: 'ACTIF' },
  { id: 2, nom: 'agent', description: 'Agent demandeur', statut: 'ACTIF' },
  { id: 3, nom: 'chauffeur', description: 'Chauffeur', statut: 'ACTIF' },
  { id: 4, nom: 'dag', description: 'Service des chauffeurs', statut: 'ACTIF' },
];

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/roles`;

  list(): Observable<Role[]> {
    if (environment.useMockData) {
      return of(MOCK_ROLES).pipe(delay(150));
    }
    return this.http.get<{ data: Role[] }>(this.base).pipe(map((r) => r.data));
  }
}
