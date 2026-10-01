import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface Permission {
  id: number;
  code: string;
  libelle: string;
  description: string;
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/permissions`;

  // GET /api/permissions
  list(): Observable<Permission[]> {
    return this.http
      .get<ApiResponse<Permission[]>>(this.baseUrl)
      .pipe(
        map(response => response.data)
      );
  }

  // GET /api/permissions/{id}
  get(id: number): Observable<Permission> {
    return this.http
      .get<ApiResponse<Permission>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => response.data)
      );
  }

  // POST /api/permissions
  create(payload: {
    code: string;
    libelle: string;
    description?: string;
  }): Observable<Permission> {
    return this.http
      .post<ApiResponse<Permission>>(this.baseUrl, payload)
      .pipe(
        map(response => response.data)
      );
  }

  // PUT /api/permissions/{id}
  update(
    id: number,
    payload: {
      code?: string;
      libelle?: string;
      description?: string;
    }
  ): Observable<Permission> {
    return this.http
      .put<ApiResponse<Permission>>(
        `${this.baseUrl}/${id}`,
        payload
      )
      .pipe(
        map(response => response.data)
      );
  }

  // DELETE /api/permissions/{id}
  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${id}`
    );
  }
}