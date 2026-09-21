import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Paginated, RoleCode, User, UserPayload } from '../models/user.model';

interface Item<T> {
  data: T;
}

export interface UserQuery {
  search?: string;
  page?: number;
  perPage?: number;
}

/**
 * Accès à l'API Laravel. Endpoints attendus :
 *   GET    /users?search=&page=&per_page=
 *   GET    /users/{id}
 *   POST   /users
 *   PUT    /users/{id}
 *   PATCH  /users/{id}/status          { actif }
 *   PUT    /users/{id}/roles           { roles }
 *   POST   /users/{id}/reset-password
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(query: UserQuery = {}): Observable<Paginated<User>> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('per_page', query.perPage ?? 10);
    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<Paginated<User>>(this.base, { params });
  }

  get(id: number): Observable<User> {
    return this.http.get<Item<User>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: UserPayload): Observable<User> {
    return this.http.post<Item<User>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UserPayload): Observable<User> {
    return this.http.put<Item<User>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  setStatus(id: number, actif: boolean): Observable<User> {
    return this.http
      .patch<Item<User>>(`${this.base}/${id}/status`, { actif })
      .pipe(map((r) => r.data));
  }

  assignRoles(id: number, roles: RoleCode[]): Observable<User> {
    return this.http.put<Item<User>>(`${this.base}/${id}/roles`, { roles }).pipe(map((r) => r.data));
  }

  resetPassword(id: number): Observable<User> {
    return this.http
      .post<Item<User>>(`${this.base}/${id}/reset-password`, {})
      .pipe(map((r) => r.data));
  }
}