import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { Paginated, Role, User, UserPayload } from '../models/user.model';
import { MOCK_ROLES } from './role.service';

interface Item<T> {
  data: T;
}

export interface UserQuery {
  search?: string;
  page?: number;
  perPage?: number;
}

// ---------- Données fictives ----------
const NOMS = ['MARTIN', 'DURAND', 'BANK', 'COJOE', 'DERAN', 'BBRIT', 'NDONG', 'OBAME', 'MOUSSAVOU', 'ONDO', 'ELLA', 'ASSOUMOU', 'MBA', 'NZAMBA', 'BOULINGUI'];
const PRENOMS = ['Jean', 'Pierre', 'Mark', 'Marie', 'Alice', 'Paul', 'Sophie', 'Kevin', 'Léa', 'Patrick', 'Clarisse', 'Eric', 'Nadège', 'Hervé', 'Sylvie'];

function buildMockUsers(): User[] {
  const users: User[] = [];
  for (let i = 1; i <= 150; i++) {
    const nom = NOMS[i % NOMS.length];
    const prenom = PRENOMS[(i * 3) % PRENOMS.length];
    const login = i % 4 === 0 ? `chauffeur${(i % 5) + 1}` : 'admin';
    const roleIndex = i % 3 === 0 ? 2 : i % 3 === 1 ? 0 : 1; // chauffeur / super_admin / agent
    users.push({
      id: i,
      nom,
      prenom,
      email: `${login}${i}@aninf.ga`,
      statut: i % 5 === 0 ? 'INACTIF' : 'ACTIF',
      must_change_password: i % 7 === 0,
      direction_id: (i % 6) + 1,
      roles: [MOCK_ROLES[roleIndex]],
    });
  }
  return users;
}

let MOCK_USERS: User[] = buildMockUsers();
let nextId = MOCK_USERS.length + 1;

/**
 * Accès à l'API Laravel. Endpoints confirmés par la documentation :
 *   GET    /users?search=&page=&per_page=
 *   GET    /users/{id}
 *   POST   /users                          { nom, prenom, email, direction_id }
 *   PUT    /users/{id}                     idem, champs optionnels
 *   PATCH  /users/{id}/activate            sans corps
 *   PATCH  /users/{id}/deactivate          sans corps
 *   PUT    /users/{id}/roles               { role_ids: number[] }
 *   POST   /users/{id}/reset-password      sans corps
 *
 * Tant que environment.useMockData vaut true, ces méthodes travaillent
 * sur un tableau en mémoire (MOCK_USERS) au lieu d'appeler l'API.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(query: UserQuery = {}): Observable<Paginated<User>> {
    if (environment.useMockData) {
      const page = query.page ?? 1;
      const perPage = query.perPage ?? 20;
      const search = query.search?.trim().toLowerCase();
      const filtered = search
        ? MOCK_USERS.filter((u) =>
            `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search),
          )
        : MOCK_USERS;
      const start = (page - 1) * perPage;
      const data = filtered.slice(start, start + perPage);
      return of({
        data,
        meta: {
          current_page: page,
          per_page: perPage,
          total: filtered.length,
          last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
        },
      }).pipe(delay(200));
    }

    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('per_page', query.perPage ?? 20);
    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<Paginated<User>>(this.base, { params });
  }

  get(id: number): Observable<User> {
    if (environment.useMockData) {
      const found = MOCK_USERS.find((u) => u.id === id);
      if (!found) {
        return of(undefined as unknown as User).pipe(
          delay(200),
          map(() => {
            throw new Error('not found');
          }),
        );
      }
      return of(found).pipe(delay(200));
    }
    return this.http.get<Item<User>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: UserPayload): Observable<User> {
    if (environment.useMockData) {
      const created: User = {
        id: nextId++,
        nom: payload.nom,
        prenom: payload.prenom,
        email: payload.email,
        statut: 'ACTIF',
        must_change_password: true,
        direction_id: payload.direction_id,
        roles: [],
      };
      MOCK_USERS = [created, ...MOCK_USERS];
      return of(created).pipe(delay(250));
    }
    return this.http.post<Item<User>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: UserPayload): Observable<User> {
    if (environment.useMockData) {
      MOCK_USERS = MOCK_USERS.map((u) => (u.id === id ? { ...u, ...payload } : u));
      return of(MOCK_USERS.find((u) => u.id === id)!).pipe(delay(250));
    }
    return this.http.put<Item<User>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  activate(id: number): Observable<User> {
    if (environment.useMockData) {
      MOCK_USERS = MOCK_USERS.map((u) => (u.id === id ? { ...u, statut: 'ACTIF' } : u));
      return of(MOCK_USERS.find((u) => u.id === id)!).pipe(delay(200));
    }
    return this.http.patch<Item<User>>(`${this.base}/${id}/activate`, {}).pipe(map((r) => r.data));
  }

  deactivate(id: number): Observable<User> {
    if (environment.useMockData) {
      MOCK_USERS = MOCK_USERS.map((u) => (u.id === id ? { ...u, statut: 'INACTIF' } : u));
      return of(MOCK_USERS.find((u) => u.id === id)!).pipe(delay(200));
    }
    return this.http.patch<Item<User>>(`${this.base}/${id}/deactivate`, {}).pipe(map((r) => r.data));
  }

  assignRoles(id: number, roleIds: number[]): Observable<User> {
    if (environment.useMockData) {
      const roles: Role[] = MOCK_ROLES.filter((r) => roleIds.includes(r.id));
      MOCK_USERS = MOCK_USERS.map((u) => (u.id === id ? { ...u, roles } : u));
      return of(MOCK_USERS.find((u) => u.id === id)!).pipe(delay(200));
    }
    return this.http
      .put<Item<User>>(`${this.base}/${id}/roles`, { role_ids: roleIds })
      .pipe(map((r) => r.data));
  }

  resetPassword(id: number): Observable<{ must_change_password: boolean }> {
    if (environment.useMockData) {
      MOCK_USERS = MOCK_USERS.map((u) => (u.id === id ? { ...u, must_change_password: true } : u));
      return of({ must_change_password: true }).pipe(delay(200));
    }
    return this.http
      .post<{ data: { must_change_password: boolean } }>(`${this.base}/${id}/reset-password`, {})
      .pipe(map((r) => r.data));
  }
}