import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';

export type RessourceTransport = 'CHAUFFEUR' | 'VEHICULE';
export interface TransportItem { id: number; type: string; type_ressource: RessourceTransport; ressource_id: number; course_id?: number | null; details?: string; signale_a?: string; debut_a?: string; fin_estimee_a?: string | null; fin_effective_a?: string | null; motif?: string; lock_version?: number; }
interface ListResponse<T> { data: T[]; meta?: { current_page: number; last_page: number; total: number }; }
interface ItemResponse<T> { data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class TransportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/transport`;
  private headers() { return new HttpHeaders({ 'Idempotency-Key': globalThis.crypto.randomUUID() }); }
  signalements() { return this.http.get<ListResponse<TransportItem>>(`${this.base}/signalements`, { params: new HttpParams().set('per_page', 50) }); }
  indisponibilites() { return this.http.get<ListResponse<TransportItem>>(`${this.base}/indisponibilites`, { params: new HttpParams().set('ouverte', true).set('per_page', 50) }); }
  signaler(payload: { type: string; type_ressource: RessourceTransport; ressource_id: number; course_id?: number; details: string }) { return this.http.post<ItemResponse<TransportItem>>(`${this.base}/signalements`, payload, { headers: this.headers() }); }
  indisponibilite(payload: { type_ressource: RessourceTransport; ressource_id: number; version_ressource_attendue: number; debut_a: string; fin_estimee_a: string | null; motif: string }) { return this.http.post<ItemResponse<TransportItem>>(`${this.base}/indisponibilites`, payload, { headers: this.headers() }); }
}
