import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type StatutReference = 'ACTIF' | 'INACTIF';

export interface DirectionParametre {
  id: number;
  nom: string;
  code: string;
  description: string | null;
  statut: StatutReference;
  lock_version: number;
}

export interface ServiceParametre {
  id: number;
  direction_id: number | string | null;
  direction?: { id?: number | string; nom?: string; name?: string } | string | null;
  direction_nom?: string | null;
  nom: string;
  code: string;
  description: string | null;
  statut: StatutReference;
  lock_version: number;
}

export interface TypeSortieParametre {
  id: number;
  libelle: string;
  code: string;
}

export interface EntiteGeographiqueParametre {
  id: number;
  adresse: string;
  latitude: string | number | null;
  longitude: string | number | null;
  description: string | null;
}

export interface VehiculeParametre {
  id: number;
  immatriculation: string;
  marque: string;
  modele: string;
  statut: StatutReference;
  lock_version: number;
}

export interface ApiItem<T> {
  message: string;
  data: T;
}

export interface ApiList<T> extends ApiItem<T[]> {
  meta?: { current_page: number; per_page: number; total: number; last_page: number };
}

@Injectable({ providedIn: 'root' })
export class ParametrageService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly vehiculesBase = `${this.base}/vehicules`;

  listDirections(search = '', page = 1): Observable<ApiList<DirectionParametre>> {
    return this.http.get<ApiList<DirectionParametre>>(`${this.base}/parametrage/directions`, {
      params: new HttpParams().set('page', page).set('per_page', 100).set('search', search),
    });
  }

  getDirection(id: number): Observable<ApiItem<DirectionParametre>> {
    return this.http.get<ApiItem<DirectionParametre>>(`${this.base}/directions/${id}`);
  }

  createDirection(payload: { nom: string; code: string; description: string | null }): Observable<ApiItem<DirectionParametre>> {
    return this.http.post<ApiItem<DirectionParametre>>(`${this.base}/directions`, payload, {
      headers: this.idempotencyHeaders(),
    });
  }

  updateDirection(id: number, payload: { nom: string; description: string | null; version_attendue: number; motif?: string }): Observable<ApiItem<DirectionParametre>> {
    return this.http.put<ApiItem<DirectionParametre>>(`${this.base}/directions/${id}`, payload, {
      headers: this.idempotencyHeaders(),
    });
  }

  changeDirectionStatus(id: number, status: StatutReference, version: number, motif: string): Observable<ApiItem<DirectionParametre>> {
    return this.http.put<ApiItem<DirectionParametre>>(
      `${this.base}/directions/${id}/${status === 'ACTIF' ? 'activate' : 'deactivate'}`,
      { version_attendue: version, motif },
      { headers: this.idempotencyHeaders() },
    );
  }

  listServices(options: { search?: string; directionId?: number; status?: StatutReference; page?: number } = {}): Observable<ApiList<ServiceParametre>> {
    let params = new HttpParams().set('page', options.page ?? 1).set('per_page', 100);
    if (options.search) params = params.set('search', options.search);
    if (options.directionId) params = params.set('direction_id', options.directionId);
    if (options.status) params = params.set('statut', options.status);
    return this.http.get<ApiList<ServiceParametre>>(`${this.base}/parametrage/services`, { params });
  }

  createService(payload: { direction_id: number; nom: string; code: string; description: string | null }): Observable<ApiItem<ServiceParametre>> {
    return this.http.post<ApiItem<ServiceParametre>>(`${this.base}/services`, payload, {
      headers: this.idempotencyHeaders(),
    });
  }

  getService(id: number): Observable<ApiItem<ServiceParametre>> {
    return this.http.get<ApiItem<ServiceParametre>>(`${this.base}/services/${id}`);
  }

  updateService(id: number, payload: { nom: string; description: string | null; version_attendue: number; motif?: string }): Observable<ApiItem<ServiceParametre>> {
    return this.http.put<ApiItem<ServiceParametre>>(`${this.base}/services/${id}`, payload, {
      headers: this.idempotencyHeaders(),
    });
  }

  changeServiceStatus(id: number, status: StatutReference, version: number, motif: string): Observable<ApiItem<ServiceParametre>> {
    return this.http.put<ApiItem<ServiceParametre>>(
      `${this.base}/services/${id}/${status === 'ACTIF' ? 'activate' : 'deactivate'}`,
      { version_attendue: version, motif },
      { headers: this.idempotencyHeaders() },
    );
  }

  listTypesSortie(): Observable<ApiList<TypeSortieParametre>> {
    return this.http.get<ApiList<TypeSortieParametre>>(`${this.base}/types-sortie`);
  }

  createTypeSortie(payload: { libelle: string; code: string }): Observable<ApiItem<TypeSortieParametre>> {
    return this.http.post<ApiItem<TypeSortieParametre>>(`${this.base}/types-sortie`, payload);
  }

  updateTypeSortie(id: number, payload: { libelle: string; code: string }): Observable<ApiItem<TypeSortieParametre>> {
    return this.http.put<ApiItem<TypeSortieParametre>>(`${this.base}/types-sortie/${id}`, payload);
  }

  deleteTypeSortie(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/types-sortie/${id}`);
  }

  listLieux(): Observable<ApiList<EntiteGeographiqueParametre>> {
    return this.http.get<ApiList<EntiteGeographiqueParametre>>(`${this.base}/entites-geographiques`);
  }

  listVehicules(search = '', page = 1): Observable<ApiList<VehiculeParametre>> {
    return this.http.get<ApiList<VehiculeParametre>>(this.vehiculesBase, {
      params: new HttpParams().set('page', page).set('per_page', 100).set('search', search),
    });
  }

  createVehicule(payload: Pick<VehiculeParametre, 'immatriculation' | 'marque' | 'modele' | 'statut'>): Observable<ApiItem<VehiculeParametre>> {
    return this.http.post<ApiItem<VehiculeParametre>>(this.vehiculesBase, payload, { headers: this.idempotencyHeaders() });
  }

  deleteVehicule(id: number, version: number): Observable<ApiItem<VehiculeParametre>> {
    return this.http.delete<ApiItem<VehiculeParametre>>(`${this.vehiculesBase}/${id}`, {
      headers: this.idempotencyHeaders().set('X-Expected-Version', String(version)).set('X-Change-Reason', encodeURIComponent('Retrait du parc automobile')),
    });
  }

  createLieu(payload: Omit<EntiteGeographiqueParametre, 'id'>): Observable<ApiItem<EntiteGeographiqueParametre>> {
    return this.http.post<ApiItem<EntiteGeographiqueParametre>>(`${this.base}/entites-geographiques`, payload);
  }

  updateLieu(id: number, payload: Omit<EntiteGeographiqueParametre, 'id'>): Observable<ApiItem<EntiteGeographiqueParametre>> {
    return this.http.put<ApiItem<EntiteGeographiqueParametre>>(`${this.base}/entites-geographiques/${id}`, payload);
  }

  deleteLieu(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/entites-geographiques/${id}`);
  }

  private idempotencyHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': globalThis.crypto.randomUUID() });
  }
}
