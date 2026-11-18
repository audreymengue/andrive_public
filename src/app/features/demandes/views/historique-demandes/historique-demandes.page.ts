import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, Location, DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { ApiService } from '@/core/services/api.service';
import { CoreService } from '@/core/services/core.service';

export interface DemandeSortie {
  id: number;
  reference: string;
  motif: string;
  date_depart: string;
  heure_depart: string;
  date_retour?: string;
  heure_retour?: string;
  statut: string;
  adresse_depart?: any;
  adresse_retour?: any;
  destinations?: any[];
  destination?: any;
  created_at: string;
}

@Component({
  selector: 'app-historique-demandes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './historique-demandes.page.html',
  styleUrl: './historique-demandes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoriqueDemandesPage implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly coreService = inject(CoreService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly filterForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
  });

  protected readonly demandes = signal<DemandeSortie[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly title = this.route.snapshot.data['title'] ?? 'Suivi de mes demandes';

  protected readonly page = signal<number>(1);
  protected readonly perPage = 10;
  protected readonly total = signal<number>(0);
  protected readonly lastPage = signal<number>(1);

  constructor() {
    this.filterForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.page.set(1);
        this.chargerDemandes();
      });
  }

  ngOnInit(): void {
    this.chargerDemandes();
  }

  protected chargerDemandes(): void {
    this.loading.set(true);
    this.error.set(null);

    const formValues = this.filterForm.value;
    const queryParams: any = {
      page: this.page(),
      per_page: this.perPage,
    };

    // L'API renvoie par défaut toutes les demandes aux super-admins.
    // L'historique personnel précise donc l'utilisateur connecté.
    const demandeurId = this.coreService.currentUser()?.id;
    if (demandeurId) {
      queryParams.demandeur_id = demandeurId;
    }

    if (formValues.search) {
      queryParams.search = formValues.search;
    }

    this.apiService.get<any>('/demandes', { params: queryParams })
      .pipe(
        catchError((err) => {
          this.loading.set(false);
          this.error.set("Impossible de récupérer l'historique de vos demandes depuis le serveur.");
          console.error('Erreur API Laravel :', err);
          return of({ data: [], meta: { current_page: 1, per_page: 10, total: 0, last_page: 1 } });
        })
      )
      .subscribe((res) => {
        const listData = res?.data ?? res;
        console.log('Données reçues de l’API :', listData); // Utile pour inspecter la structure exacte des destinations
        this.demandes.set(Array.isArray(listData) ? listData : []);
        this.total.set(res?.meta?.total ?? listData.length);
        this.lastPage.set(Math.max(1, res?.meta?.last_page ?? 1));
        this.loading.set(false);
      });
  }

  /**
   * Analyse toutes les variantes possibles de l'API pour récupérer la destination
   */
  protected getDestinationLabel(demande: DemandeSortie): string {
    // 1. Si un tableau de destinations existe et contient des éléments
    if (demande.destinations && demande.destinations.length > 0) {
      const dest = demande.destinations[0];
      if (typeof dest === 'string') return dest;
      const entite = dest.entite_geographique ?? dest.entiteGeographique;
      return entite?.adresse || dest.adresse || dest.libelle || dest.nom || dest.quartier || 'Destination non spécifiée';
    }
    // 2. Si une destination simple existe
    if (demande.destination) {
      if (typeof demande.destination === 'string') return demande.destination;
      return demande.destination.adresse || demande.destination.libelle || demande.destination.nom || 'Destination non spécifiée';
    }
    // 3. Repli sur l'adresse de retour
    if (demande.adresse_retour?.adresse) {
      return demande.adresse_retour.adresse;
    }
    return 'Non spécifiée';
  }

  protected retourEnArriere(): void {
    this.location.back();
  }

  protected nouvelleDemande(): void {
    this.router.navigate(['/dashboard/demandes/transport']);
  }

  protected voirDetail(demande: DemandeSortie): void {
    this.router.navigate(['/dashboard/demandes', demande.id]);
  }

  protected changerPage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.lastPage() && newPage !== this.page()) {
      this.page.set(newPage);
      this.chargerDemandes();
    }
  }

  protected retourEnHaut(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected getStatutBadgeClass(statut: string): string {
    switch (statut?.toUpperCase()) {
      case 'VALIDEE': return 'badge--success';
      case 'APPROUVEE': return 'badge--success';
      case 'EN_ATTENTE': return 'badge--warning';
      case 'EN_COURS': return 'badge--info';
      case 'BROUILLON': return 'badge--draft';
      case 'TERMINEE': return 'badge--success';
      case 'ANNULEE': return 'badge--danger';
      case 'REFUSEE': return 'badge--danger';
      case 'REVALIDATION_REQUISE': return 'badge--warning';
      default: return 'badge--draft';
    }
  }

  protected getStatutLabel(statut: string): string {
    if (!statut) return 'Inconnu';
    switch (statut.toUpperCase()) {
      case 'VALIDEE': return 'Validée';
      case 'APPROUVEE': return 'Approuvée';
      case 'EN_ATTENTE': return 'En attente';
      case 'EN_COURS': return 'En cours';
      case 'BROUILLON': return 'Brouillon';
      case 'TERMINEE': return 'Terminée';
      case 'ANNULEE': return 'Annulée';
      case 'REFUSEE': return 'Refusée';
      case 'REVALIDATION_REQUISE': return 'Revalidation requise';
      default: return statut;
    }
  }
}
