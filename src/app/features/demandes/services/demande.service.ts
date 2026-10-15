
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DemandeEmploye {
  nom: string;
  prenom: string;
  fonction?: string | null;
}

export interface DemandeDestination {
  entite_geographique_id: number;
  ordre: number;
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
  adresse_retour_id?: number | null;
  date_depart: string;
  heure_depart: string;
  heure_retour?: string | null;
  motif: string;
  commentaire?: string | null;
  destinations: DemandeDestination[];
  employes: DemandeEmploye[];
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
      `${environment.apiUrl}/references/directions`
    );
  }

  chargerTypesSortie(): Observable<{ data: { id: number; libelle: string }[] }> {
    return this.http.get<{ data: { id: number; libelle: string }[] }>(
      `${environment.apiUrl}/references/types-sortie`
    );
  }

  chargerEntitesGeographiques(): Observable<{ data: { id: number; adresse: string }[] }> {
    return this.http.get<{ data: { id: number; adresse: string }[] }>(
      `${environment.apiUrl}/references/entites-geographiques`
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
