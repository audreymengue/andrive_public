import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '@/core/services/api.service';

interface DemandeDetail {
  id: number;
  reference: string;
  motif: string;
  commentaire?: string | null;
  statut: string;
  created_at?: string | null;
  date_depart: string;
  heure_depart: string;
  heure_retour?: string | null;
  chauffeur_nom?: string | null;
  chauffeur_prenom?: string | null;
  chauffeur_telephone?: string | null;
  vehicule_marque?: string | null;
  vehicule_modele?: string | null;
  demandeur?: { nom: string; prenom: string } | null;
  direction?: { nom: string } | null;
  service?: { id: number; nom: string; code?: string } | null;
  type_sortie?: { libelle: string } | null;
  adresse_depart?: { adresse: string } | null;
  adresse_retour?: { adresse: string } | null;
  destinations: Array<{
    ordre: number;
    entite_geographique?: { adresse: string } | null;
  }>;
  employes: Array<{ nom: string; prenom: string; fonction?: string | null }>;
  objets: Array<{ designation: string; quantite?: number | null; description?: string | null }>;
}

@Component({
  selector: 'app-detail-demande-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './detail-demande.page.html',
  styleUrl: './detail-demande.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailDemandePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly demande = signal<DemandeDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly returnLabel = signal('Retour à l’historique');

  private id = 0;
  private returnPath = '/dashboard/demandes/historique';
  private treatmentSource = false;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.treatmentSource = this.route.snapshot.queryParamMap.get('source') === 'traitement';
    if (this.treatmentSource) {
      this.returnPath = '/dashboard/gestion/demandes';
      this.returnLabel.set('Retour au traitement');
    }
    this.charger();
  }

  protected charger(): void {
    if (!Number.isInteger(this.id) || this.id < 1) {
      this.error.set('La référence de la demande est invalide.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const endpoint = this.treatmentSource ? `/traitement/demandes/${this.id}` : `/demandes/${this.id}`;
    this.api.get<{ data: DemandeDetail }>(endpoint)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.error.set(
            err.status === 401
              ? 'Votre session a expiré. Reconnectez-vous pour consulter cette demande.'
              : err.status === 403
                ? 'Vous n’avez pas l’autorisation de consulter cette demande.'
                : err.status === 404
                  ? 'Cette demande est introuvable ou ne vous est pas accessible.'
                  : err.status === 0
                    ? 'Impossible de joindre le serveur. Vérifiez que l’API est démarrée.'
                    : `Le serveur n’a pas pu charger cette demande (HTTP ${err.status}).`
          );
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe((response) => {
        const envelope = response as { data?: unknown } | null;
        const firstLevel = envelope?.data;
        const nestedEnvelope = firstLevel && typeof firstLevel === 'object' && 'data' in firstLevel
          ? (firstLevel as { data?: unknown }).data
          : undefined;
        const detail = nestedEnvelope ?? firstLevel ?? response;

        if (!detail || typeof detail !== 'object' || !('id' in detail)) {
          this.error.set('La réponse du serveur ne contient pas le détail de cette demande.');
          this.loading.set(false);
          return;
        }

        const demande = detail as DemandeDetail;
        this.demande.set({
          ...demande,
          destinations: Array.isArray(demande.destinations) ? demande.destinations : [],
          employes: Array.isArray(demande.employes) ? demande.employes : [],
          objets: Array.isArray(demande.objets) ? demande.objets : [],
        });
        this.loading.set(false);
      });
  }

  protected retourHistorique(): void {
    void this.router.navigate([this.returnPath]);
  }

  protected heure(value?: string | null): string {
    return value ? value.slice(0, 5) : '—';
  }

  protected chauffeurNom(demande: DemandeDetail): string {
    return [demande.chauffeur_prenom, demande.chauffeur_nom].filter(Boolean).join(' ') || '—';
  }

  protected vehiculeNom(demande: DemandeDetail): string {
    return [demande.vehicule_marque, demande.vehicule_modele].filter(Boolean).join(' ') || '—';
  }

  protected statutClass(statut: string): string {
    switch (statut.toUpperCase()) {
      case 'VALIDEE':
      case 'TERMINEE':
        return 'status--success';
      case 'EN_ATTENTE':
      case 'REVALIDATION_REQUISE':
        return 'status--pending';
      case 'REFUSEE':
      case 'ANNULEE':
        return 'status--danger';
      default:
        return 'status--draft';
    }
  }

  protected statutLabel(statut: string): string {
    const labels: Record<string, string> = {
      VALIDEE: 'Validée',
      EN_ATTENTE: 'En attente',
      REVALIDATION_REQUISE: 'Revalidation requise',
      REFUSEE: 'Refusée',
      ANNULEE: 'Annulée',
      TERMINEE: 'Terminée',
      BROUILLON: 'Brouillon',
    };
    return labels[statut.toUpperCase()] ?? statut;
  }
}
