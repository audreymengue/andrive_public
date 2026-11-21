import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';

export type RessourceTransport = 'CHAUFFEUR' | 'VEHICULE';
export interface TransportItem { id: number; type: string; type_ressource: RessourceTransport; ressource_id: number; course_id?: number | null; details?: string; signale_a?: string; debut_a?: string; fin_estimee_a?: string | null; fin_effective_a?: string | null; motif?: string; lock_version?: number; }
export interface CancellationAlert { id: number; demande_id: number; reference: string; motif: string | null; signalee_a: string | null; auteur: string | null; }
export interface ChauffeurTransport { id: number; statut: string; lock_version: number; utilisateur?: { nom: string; prenom: string } | null; }
export interface VehiculeTransport { id: number; immatriculation: string; statut: string; lock_version: number; }
export interface IndisponibiliteTransport { id: number; type_ressource: RessourceTransport; ressource_id: number; debut_a: string; fin_estimee_a: string | null; fin_effective_a: string | null; motif: string; lock_version: number; }
interface ListResponse<T> { data: T[]; meta?: { current_page: number; last_page: number; total: number }; }
interface ItemResponse<T> { data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class TransportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/transport`;
  private headers() { return new HttpHeaders({ 'Idempotency-Key': globalThis.crypto.randomUUID() }); }
  signalements() { return this.http.get<ListResponse<TransportItem>>(`${this.base}/signalements`, { params: new HttpParams().set('per_page', 50) }); }
  annulations() { return this.http.get<{ data: CancellationAlert[] }>(`${this.base}/annulations`); }
  chauffeursActifs() { return this.http.get<ListResponse<ChauffeurTransport>>(`${environment.apiUrl}/parametrage/chauffeurs`, { params: new HttpParams().set('statut', 'ACTIF').set('per_page', 100) }); }
  vehiculesActifs() { return this.http.get<ListResponse<VehiculeTransport>>(`${environment.apiUrl}/parametrage/vehicules`, { params: new HttpParams().set('statut', 'ACTIF').set('per_page', 100) }); }
  indisponibilites(ouverte = true) { return this.http.get<ListResponse<IndisponibiliteTransport>>(`${this.base}/indisponibilites`, { params: new HttpParams().set('ouverte', ouverte).set('per_page', 100) }); }
  signaler(payload: { type: string; type_ressource: RessourceTransport; ressource_id: number; course_id?: number; details: string }) { return this.http.post<ItemResponse<TransportItem>>(`${this.base}/signalements`, payload, { headers: this.headers() }); }
  indisponibilite(payload: { type_ressource: RessourceTransport; ressource_id: number; version_ressource_attendue: number; debut_a: string; fin_estimee_a: string | null; motif: string }) { return this.http.post<ItemResponse<TransportItem>>(`${this.base}/indisponibilites`, payload, { headers: this.headers() }); }
  creerIndisponibilite(payload: { type_ressource: RessourceTransport; ressource_id: number; version_ressource_attendue: number; debut_a: string; fin_estimee_a: string | null; motif: string }) { return this.http.post<ItemResponse<IndisponibiliteTransport>>(`${this.base}/indisponibilites`, payload, { headers: this.headers() }); }
  remettreEnService(id: number, payload: { version_attendue: number; fin_effective_a: string; motif: string }) { return this.http.post<ItemResponse<IndisponibiliteTransport>>(`${this.base}/indisponibilites/${id}/remise-en-service`, payload, { headers: this.headers() }); }
}
