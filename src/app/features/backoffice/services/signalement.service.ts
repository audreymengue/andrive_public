import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

export type SignalementType = 'RETARD' | 'PANNE' | 'ABSENCE' | 'IMPOSSIBILITE' | 'INDISPONIBILITE';
export type TypeRessource = 'VEHICULE' | 'CHAUFFEUR';

export interface Signalement {
  id: number;
  type: SignalementType;
  type_ressource: TypeRessource;
  ressource_id: number;
  course_id?: number | null;
  details: string;
  signale_a?: string | null;
  [key: string]: unknown;
}

export interface SignalementsResponse {
  data: Signalement[];
  meta?: { current_page?: number; last_page?: number; per_page?: number; total?: number };
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface SignalementResponse { data: Signalement; message?: string; }
export interface SignalementFilters { course_id?: number; type_ressource?: TypeRessource | ''; ressource_id?: number; page?: number; per_page?: number; }
export interface CreateSignalement {
  type: SignalementType;
  type_ressource: TypeRessource;
  ressource_id: number;
  course_id?: number;
  details: string;
}

@Injectable({ providedIn: 'root' })
export class SignalementService {
  private readonly api = inject(ApiService);
  private readonly endpoint = '/transport/signalements';

  list(filters: SignalementFilters): Observable<SignalementsResponse> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, value);
    });
    return this.api.get<SignalementsResponse>(this.endpoint, { params });
  }

  create(payload: CreateSignalement): Observable<SignalementResponse> {
    return this.api.post<SignalementResponse>(this.endpoint, payload, {
      headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` },
    });
  }

  get(id: number): Observable<SignalementResponse> {
    return this.api.get<SignalementResponse>(`${this.endpoint}/${id}`);
  }
}
