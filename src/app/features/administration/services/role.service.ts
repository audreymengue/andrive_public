import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Permission, Role } from '../models/user.model';

export type { Permission, Role } from '../models/user.model';

export interface CreateRoleDto {
  nom: string;
  description?: string;
  statut?: string;
}

export interface UpdateRoleDto extends Partial<CreateRoleDto> {}

export const MOCK_ROLES: Role[] = [
  { id: 1, nom: 'super_admin', description: "Administrateur principal de l'application", statut: 'ACTIF' },
  { id: 2, nom: 'agent', description: 'Agent demandeur', statut: 'ACTIF' },
  { id: 3, nom: 'chauffeur', description: 'Chauffeur', statut: 'ACTIF' },
  { id: 4, nom: 'dag', description: 'Service des chauffeurs', statut: 'ACTIF' },
];

interface ApiResponse<T> {
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly rolesUrl = `${environment.apiUrl}/roles`;
  private readonly permissionsUrl = `${environment.apiUrl}/permissions`;

  /** Forme enveloppée attendue par la page apportée par feature/role-api. */
  getRoles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(this.rolesUrl);
  }

  /** Forme normalisée utilisée par les autres formulaires de l’administration. */
  list(): Observable<Role[]> {
    return this.getRoles().pipe(map((response) => response.data));
  }

  getRole(id: number): Observable<Role> {
    return this.http.get<ApiResponse<Role>>(`${this.rolesUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  createRole(payload: CreateRoleDto): Observable<Role> {
    return this.http.post<ApiResponse<Role>>(this.rolesUrl, payload)
      .pipe(map((response) => response.data));
  }

  create(payload: CreateRoleDto): Observable<Role> {
    return this.createRole(payload);
  }

  updateRole(id: number, payload: UpdateRoleDto): Observable<Role> {
    return this.http.put<ApiResponse<Role>>(`${this.rolesUrl}/${id}`, payload)
      .pipe(map((response) => response.data));
  }

  update(id: number, payload: UpdateRoleDto): Observable<Role> {
    return this.updateRole(id, payload);
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.rolesUrl}/${id}`);
  }

  delete(id: number): Observable<void> {
    return this.deleteRole(id);
  }

  getPermissions(): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(this.permissionsUrl);
  }

  getPermission(id: number): Observable<Permission> {
    return this.http.get<ApiResponse<Permission>>(`${this.permissionsUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  assignPermissionsToRole(roleId: number, permissionIds: number[]): Observable<ApiResponse<Role>> {
    return this.http.put<ApiResponse<Role>>(`${this.rolesUrl}/${roleId}/permissions`, {
      permission_ids: permissionIds,
    });
  }

  assignPermissions(roleId: number, permissionIds: number[]): Observable<Role> {
    return this.assignPermissionsToRole(roleId, permissionIds)
      .pipe(map((response) => response.data));
  }

}
