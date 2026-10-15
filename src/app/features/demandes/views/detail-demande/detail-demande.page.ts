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
  demandeur?: { nom: string; prenom: string } | null;
  direction?: { nom: string } | null;
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

  private id = 0;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
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
    this.api.get<{ data: DemandeDetail }>(`/demandes/${this.id}`)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.error.set(
            err.status === 404
              ? 'Cette demande est introuvable.'
              : 'Impossible de récupérer le détail de la demande.'
          );
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response?.data) this.demande.set(response.data);
        this.loading.set(false);
      });
  }

  protected retourHistorique(): void {
    void this.router.navigate(['/dashboard/demandes/historique']);
  }

  protected heure(value?: string | null): string {
    return value ? value.slice(0, 5) : '—';
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
