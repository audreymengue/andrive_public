import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
    return this.http.get<{ data: Role[] }>(this.base).pipe(map((r) => r.data));
  }

  create(payload: { nom: string; description?: string }): Observable<Role> {
    return this.http.post<{ data: Role }>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: { nom?: string; description?: string }): Observable<Role> {
    return this.http.put<{ data: Role }>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  assignPermissions(id: number, permissionIds: number[]): Observable<Role> {
    return this.http.put<{ data: Role }>(`${this.base}/${id}/permissions`, {
      permission_ids: permissionIds,
    }).pipe(map((r) => r.data));
  }
}
