import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/core/services/api.service';

interface HistoryDemande {
  id: number;
  reference: string;
  statut: string;
  direction: { id: number; nom: string } | null;
  service: { id: number; nom: string } | null;
  date_depart: string | null;
  heure_depart: string | null;
}

interface ApiList<T> {
  message: string;
  data: T[];
  meta?: { current_page: number; last_page: number; total: number };
}

@Component({
  selector: 'app-traitement-historique-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './traitement-historique.page.html',
  styleUrl: './traitement-historique.page.scss',
})
export class TraitementHistoriquePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly demandes = signal<HistoryDemande[]>([]);
  protected readonly search = signal('');
  protected readonly statut = signal('');
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly cancelTarget = signal<HistoryDemande | null>(null);
  protected readonly cancelReason = signal('');
  protected readonly cancelError = signal('');
  protected readonly cancelSuccess = signal('');
  protected readonly cancelSaving = signal(false);

  ngOnInit(): void { this.charger(); }

  protected changerRecherche(value: string): void { this.search.set(value); this.page.set(1); this.charger(); }
  protected changerStatut(value: string): void { this.statut.set(value); this.page.set(1); this.charger(); }
  protected retourDemandes(): void { void this.router.navigate(['/dashboard/gestion/demandes']); }

  protected demanderAnnulation(demande: HistoryDemande): void {
    this.cancelTarget.set(demande);
    this.cancelReason.set('');
    this.cancelError.set('');
  }

  protected fermerAnnulation(): void {
    if (this.cancelSaving()) return;
    this.cancelTarget.set(null);
    this.cancelError.set('');
  }

  protected confirmerAnnulation(): void {
    const demande = this.cancelTarget();
    const motif = this.cancelReason().trim();
    if (!demande || !motif || this.cancelSaving()) {
      this.cancelError.set('Saisissez le motif de l’annulation.');
      return;
    }
    this.cancelSaving.set(true);
    this.cancelError.set('');
    this.api.post(`/demandes/${demande.id}/annulation`, { motif }).subscribe({
      next: () => {
        this.demandes.update((items) => items.map((item) => item.id === demande.id ? { ...item, statut: 'ANNULEE' } : item));
        this.cancelSuccess.set(`La demande ${demande.reference} a été annulée et le chauffeur associé a été informé.`);
        this.cancelTarget.set(null);
        this.cancelSaving.set(false);
      },
      error: (failure: unknown) => {
        const http = failure instanceof HttpErrorResponse ? failure : null;
        this.cancelError.set(http?.error?.message || 'Impossible d’annuler cette demande.');
        this.cancelSaving.set(false);
      },
    });
  }

  protected charger(): void {
    this.loading.set(true);
    this.error.set('');
    let params = new HttpParams().set('page', this.page()).set('per_page', 20);
    if (this.search().trim()) params = params.set('search', this.search().trim());
    if (this.statut()) params = params.set('statut', this.statut());
    this.api.get<ApiList<HistoryDemande>>('/traitement/demandes/historique', { params }).subscribe({
      next: (response) => {
        this.demandes.set(response.data ?? []);
        this.page.set(response.meta?.current_page ?? this.page());
        this.lastPage.set(response.meta?.last_page ?? 1);
        this.total.set(response.meta?.total ?? response.data?.length ?? 0);
        this.loading.set(false);
      },
      error: (failure: unknown) => {
        const http = failure instanceof HttpErrorResponse ? failure : null;
        this.error.set(http?.status === 403
          ? 'Votre compte ne dispose pas de la permission de consulter l’historique de traitement.'
          : http?.error?.message || 'Impossible de charger l’historique de traitement.');
        this.loading.set(false);
      },
    });
  }

  protected voirDetail(demande: HistoryDemande): void {
    void this.router.navigate(['/dashboard/demandes', demande.id], { queryParams: { source: 'traitement' } });
  }

  protected precedent(): void { if (this.page() > 1) { this.page.update((page) => page - 1); this.charger(); } }
  protected suivant(): void { if (this.page() < this.lastPage()) { this.page.update((page) => page + 1); this.charger(); } }

  protected statutLabel(value: string): string {
    const labels: Record<string, string> = { VALIDEE: 'Validée', REFUSEE: 'Refusée', ANNULEE: 'Annulée', TERMINEE: 'Terminée' };
    return labels[value] ?? value;
  }

  protected statutClass(value: string): string {
    if (value === 'VALIDEE' || value === 'TERMINEE') return 'status status--ok';
    if (value === 'REFUSEE' || value === 'ANNULEE') return 'status status--off';
    return 'status';
  }
}
