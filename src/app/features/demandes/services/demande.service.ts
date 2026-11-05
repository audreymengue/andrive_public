import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DemandeDestination {
  entite_geographique_id?: number | null;
  adresse?: string;
  ordre: number;
}

export interface DemandeObjet {
  designation: string;
  quantite?: number | null;
  description?: string | null;
}

export interface DemandePayload {
  // Informations personnelles
  direction_id: number;
  service_id: number;
  nom: string;
  prenom: string;
  fonction: string;
  motif: string;
  nombre_employes: number;

  // Sortie
  type_sortie_id: number;
  adresse_depart_id?: number | null;
  adresse_depart?: string;
  adresse_retour_id?: number | null;
  adresse_retour?: string | null;
  date_depart: string;
  heure_depart: string;
  heure_retour?: string | null;
  commentaire?: string | null;
  destinations: DemandeDestination[];
  objets?: DemandeObjet[];
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

  chargerDirections(): Observable<{ data: { id: number; nom: string }[] }> {
    return this.http.get<{ data: { id: number; nom: string }[] }>(
      `${environment.apiUrl}/directions`
    );
  }

  /** Services rattachés à une direction. */
  chargerServices(directionId: number): Observable<{ data: { id: number; nom: string }[] }> {
    return this.http.get<{ data: { id: number; nom: string }[] }>(
      `${environment.apiUrl}/directions/${directionId}/services`
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
      payload
    );
  }

  soumettre(id: number): Observable<DemandeApiResponse> {
    return this.http.post<DemandeApiResponse>(
      `${environment.apiUrl}/demandes/${id}/soumission`,
      {},
    );
  }
}
