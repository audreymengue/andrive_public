import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

export interface Permission {
  id: number;
  libelle: string;
  code: string;
  description: string;
}

export interface Role {
  id: number;
  nom: string;
  description: string;
  statut: 'ACTIF' | 'INACTIF';
  permissions: Permission[];
}

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  statut: 'ACTIF' | 'INACTIF';
  mustChangePassword: boolean;
  directionId: number;
  roles: Role[];
}

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Signal pour l'utilisateur actuel
  private readonly _currentUser = signal<User | null>(null);
  public readonly currentUser = computed(() => this._currentUser());

  // Signal pour le token
  private readonly _token = signal<string | null>(null);
  public readonly token = computed(() => this._token());

  // Vérifie si l'utilisateur est authentifié
  public readonly isAuthenticated = computed(() => !!this._token());

  // Token utilisé par l'intercepteur HTTP
  public get getToken(): string | null {
    return this._token();
  }

  constructor() {
    this.loadTokenFromStorage();
  }

  /**
   * Charge le token et l'utilisateur depuis le stockage du navigateur.
   * Aucun accès à localStorage pendant le rendu SSR.
   */
  private loadTokenFromStorage(): void {
    if (!this.isBrowser) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');

    if (token) {
      this._token.set(token);
    }

    if (userStr) {
      try {
        this._currentUser.set(JSON.parse(userStr) as User);
      } catch {
        console.error("Impossible de lire l'utilisateur enregistré.");
        localStorage.removeItem('current_user');
      }
    }
  }

  /**
   * Définit le token d'authentification.
   */
  setToken(token: string): void {
    this._token.set(token);

    if (this.isBrowser) {
      localStorage.setItem('auth_token', token);
    }
  }

  /**
   * Définit l'utilisateur actuel.
   */
  setCurrentUser(user: User): void {
    this._currentUser.set(user);

    if (this.isBrowser) {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  }

  /**
   * Déconnecte l'utilisateur.
   */
  logout(): void {
    this._token.set(null);
    this._currentUser.set(null);

    if (this.isBrowser) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
    }
  }

  /**
   * Vérifie si l'utilisateur possède un rôle.
   */
 hasRole(role: string): boolean {
  return this.currentUser()?.roles?.some(r => r.nom === role) ?? false;
}

  /**
   * Vérifie si l'utilisateur possède une permission.
   */
 hasPermission(permission: string): boolean {
  return this.currentUser()?.roles?.some(r =>
    r.permissions?.some(p => p.code === permission)
  ) ?? false;
 }
}