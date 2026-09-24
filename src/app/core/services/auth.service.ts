import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { ApiService } from '@/core/services/api.service';
import { CoreService, User } from '@/core/services/core.service';

interface ApiPermission {
  id: number;
  libelle: string;
  code: string;
  description: string;
}

interface ApiRole {
  id: number;
  nom: string;
  description: string;
  statut: 'ACTIF' | 'INACTIF';
  permissions: ApiPermission[];
}

interface ApiUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  statut: 'ACTIF' | 'INACTIF';
  must_change_password: boolean;
  direction_id: number;
  roles: ApiRole[];
}

// La vraie structure renvoyée par /login : pas de user, juste token + must_change_password
export interface LoginResponse {
  message: string;
  data: {
    token: string;
    must_change_password: boolean;
  };
}

export interface MeResponse {
  message: string;
  data: ApiUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private coreService = inject(CoreService);

  login(email: string, password: string): Observable<User> {
    return this.api.post<LoginResponse>('/login', { email, password }).pipe(
      tap((response) => {
        this.coreService.setToken(response.data.token);
      }),
      switchMap((loginResponse) =>
        this.api.get<MeResponse>('/me').pipe(
          tap((meResponse) => {
            const user = this.mapToUser({
              ...meResponse.data,
              must_change_password: loginResponse.data.must_change_password,
            });
            this.coreService.setCurrentUser(user);
          }),
          switchMap((meResponse) =>
            [this.mapToUser({
              ...meResponse.data,
              must_change_password: loginResponse.data.must_change_password,
            })]
          )
        )
      )
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api.put<void>('/api/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPassword,
    });
  }

  logout(): void {
    this.coreService.logout();
  }

  mapToUser(apiUser: ApiUser): User {
    return {
      id: apiUser.id,
      nom: apiUser.nom,
      prenom: apiUser.prenom,
      email: apiUser.email,
      statut: apiUser.statut,
      mustChangePassword: apiUser.must_change_password,
      directionId: apiUser.direction_id,
      roles: apiUser.roles,
    };
  }
}