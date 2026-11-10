import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

export type StatutVehicule = 'ACTIF' | 'INACTIF';

export interface Vehicule {
  id: number;
  immatriculation: string;
  places_utiles: number;
  statut: StatutVehicule;
  lock_version: number;
}

export interface ListeVehiculesResponse {
  message: string;
  data: Vehicule[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface VehiculeResponse {
  message: string;
  data: Vehicule;
}

@Injectable({ providedIn: 'root' })
export class VehiculeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/parametrage/vehicules`;

  list(options: {
    search?: string;
    statut?: StatutVehicule;
    page?: number;
    perPage?: number;
  } = {}): Observable<ListeVehiculesResponse> {
    let params = new HttpParams()
      .set('page', options.page ?? 1)
      .set('per_page', options.perPage ?? 10);
    if (options.search?.trim()) params = params.set('search', options.search.trim());
    if (options.statut) params = params.set('statut', options.statut);
    return this.http.get<ListeVehiculesResponse>(this.base, { params });
  }

  create(payload: { immatriculation: string; places_utiles: number }): Observable<VehiculeResponse> {
    return this.http.post<VehiculeResponse>(this.base, payload, {
      headers: new HttpHeaders({ 'Idempotency-Key': globalThis.crypto.randomUUID() }),
    });
  }
}
