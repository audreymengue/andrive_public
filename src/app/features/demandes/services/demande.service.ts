import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DemandeDestination {
  entite_geographique_id?: number | null;
  adresse: string;
  ordre: number;
}

export interface DemandeEmploye {
  nom: string;
  prenom: string;
  fonction?: string | null;
}

export interface DemandeObjet {
  designation: string;
  quantite?: number | null;
  description?: string | null;
}

export interface DemandePayload {
  direction_id: number;
  type_sortie_id: number;
  adresse_depart_id: number;
  date_depart: string;
  heure_depart: string;
  heure_retour?: string | null;
  motif: string;
  commentaire?: string | null;
  destinations: DemandeDestination[];
  employes: DemandeEmploye[];
  objets?: DemandeObjet[];
  service_id?: number;
}

export interface DemandeApiResponse {
  message: string;
  data: {
    id: number;
    reference: string;
    statut: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class DemandeService {
  private readonly http = inject(HttpClient);

  chargerDirections(): Observable<{
    data: { id: number; nom: string; code?: string }[];
  }> {
    return this.http.get<{
      data: { id: number; nom: string; code?: string }[];
    }>(
      `${environment.apiUrl}/directions`
    );
  }

  /** Services rattachés à une direction. */
  chargerServices(directionId: number): Observable<{
    data: { id: number; direction_id?: number; nom: string; code?: string }[];
  }> {
    return this.http.get<{
      data: { id: number; direction_id?: number; nom: string; code?: string }[];
    }>(
      `${environment.apiUrl}/parametrage/services`,
      {
        params: new HttpParams()
          .set('direction_id', directionId)
          .set('statut', 'ACTIF')
          .set('per_page', 100),
      }
    );
  }

  chargerTypesSortie(): Observable<{ data: { id: number; libelle: string }[] }> {
    return this.http.get<{ data: { id: number; libelle: string }[] }>(
      `${environment.apiUrl}/types-sortie`
    );
  }

  chargerEntitesGeographiques(): Observable<{ data: { id: number; adresse: string }[] }> {
    return this.http.get<{ data: { id: number; adresse: string }[] }>(
      `${environment.apiUrl}/entites-geographiques`
    );
  }

  creer(payload: DemandePayload): Observable<DemandeApiResponse> {
    return this.http.post<DemandeApiResponse>(
      `${environment.apiUrl}/demandes`,
      payload,
      { timeout: 30_000 }
    );
  }

  soumettre(id: number): Observable<DemandeApiResponse> {
    return this.http.post<DemandeApiResponse>(
      `${environment.apiUrl}/demandes/${id}/soumission`,
      {},
      { timeout: 30_000 }
    );
  }
}
