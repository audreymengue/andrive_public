import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

export type StatutProfilChauffeur = 'ACTIF' | 'INACTIF';

export interface ProfilChauffeur {
  id: number;
  user_id: number | null;
  statut: StatutProfilChauffeur;
  lock_version: number;
  utilisateur?: {
    id?: number;
    nom?: string;
    prenom?: string;
    email?: string;
    statut?: StatutProfilChauffeur;
  } | null;
  user?: {
    id?: number;
    nom?: string;
    prenom?: string;
    email?: string;
    statut?: StatutProfilChauffeur;
  } | null;
}

interface ApiItem<T> {
  message: string;
  data: T;
}

interface ApiList<T> extends ApiItem<T[]> {
  meta?: { current_page: number; per_page: number; total: number; last_page: number };
}

@Injectable({ providedIn: 'root' })
export class ChauffeurService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametrage/chauffeurs`;

  list(options: {
    search?: string;
    statut?: StatutProfilChauffeur;
    page?: number;
    perPage?: number;
  } = {}): Observable<ApiList<ProfilChauffeur>> {
    let params = new HttpParams()
      .set('page', options.page ?? 1)
      .set('per_page', options.perPage ?? 10);
    if (options.search?.trim()) params = params.set('search', options.search.trim());
    if (options.statut) params = params.set('statut', options.statut);
    return this.http.get<ApiList<ProfilChauffeur>>(this.base, { params });
  }

  create(payload: { user_id: number | null }): Observable<ApiItem<ProfilChauffeur>> {
    return this.http.post<ApiItem<ProfilChauffeur>>(this.base, payload, {
      headers: new HttpHeaders({ 'Idempotency-Key': globalThis.crypto.randomUUID() }),
    });
  }
}
