import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from '@/core/services/api.service';

interface ApiList<T> {
  message: string;
  data: T[];
  meta?: { current_page: number; per_page: number; total: number; last_page: number };
}

interface ApiItem<T> {
  message: string;
  data: T;
}

interface TreatmentDemande {
  id: number;
  reference: string;
  statut: string;
  priorite?: string | null;
  urgence?: boolean | string | null;
  direction: { id: number; nom: string } | null;
  service: { id: number; nom: string; code?: string } | null;
  date_depart: string | null;
  heure_depart: string | null;
}

interface DemandeDetail extends TreatmentDemande {
  motif: string;
  commentaire?: string | null;
  heure_retour?: string | null;
  demandeur?: { nom: string; prenom: string } | null;
  type_sortie?: { libelle: string } | null;
  adresse_depart?: { adresse: string } | null;
  adresse_retour?: { adresse: string } | null;
  destinations: Array<{ ordre: number; entite_geographique?: { adresse: string } | null }>;
  employes: Array<{ nom: string; prenom: string; fonction?: string | null }>;
  objets: Array<{ designation: string; quantite?: number | null; description?: string | null }>;
}

type DemandePriority = 'NORMALE' | 'PRIORITAIRE' | 'URGENTE';

interface CoursePreparationVersion {
  version: number;
  actor_id: number;
  demande_ids: number[];
  created_at: string | null;
}

interface CoursePreparation {
  id: number;
  statut_execution: string | null;
  lock_version: number;
  version_preparation: number;
  demande_ids: number[];
  preparations: CoursePreparationVersion[];
  created_by_id: number;
  created_at: string | null;
  updated_at: string | null;
}

@Component({
  selector: 'app-traitement-demandes-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './traitement-demandes.page.html',
  styleUrl: './traitement-demandes.page.scss',
})
export class TraitementDemandesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly demandes = signal<TreatmentDemande[]>([]);
  private readonly demandeCache = signal(new Map<number, TreatmentDemande>());
  protected readonly courses = signal<CoursePreparation[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly totalDemandes = signal(0);
  protected readonly searchTerm = signal('');
  protected readonly activeTab = signal<'all' | 'urgent' | 'priority' | 'selected'>('all');
  protected readonly selectedCourseId = signal<number | null>(null);
  protected readonly selectedDemandeDetail = signal<DemandeDetail | null>(null);
  protected readonly loadingDemandeDetail = signal(false);
  protected readonly demandeDetailError = signal('');
  protected readonly selectedDemandeIds = signal<Set<number>>(new Set());
  protected readonly priorityOverrides = signal(new Map<number, DemandePriority>());
  protected readonly priorityLocalNotice = signal(false);
  protected readonly editableCourses = computed(() => this.courses().filter((course) => course.statut_execution === null));
  protected readonly selectedDemandes = computed(() =>
    [...this.selectedDemandeIds()].map((id) => ({
      id,
      demande: this.demandeCache().get(id) ?? null,
    })),
  );
  protected readonly urgentCount = computed(() => this.demandes().filter((demande) => this.isUrgent(demande)).length);
  protected readonly priorityCount = computed(() => this.demandes().filter((demande) => this.isPriority(demande)).length);
  protected readonly visibleDemandes = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    return this.demandes().filter((demande) => {
      const selected = this.selectedDemandeIds().has(demande.id);
      if (this.activeTab() === 'selected' && !selected) {
        return false;
      }
      if (this.activeTab() === 'urgent' && !this.isUrgent(demande)) {
        return false;
      }
      if (this.activeTab() === 'priority' && !this.isPriority(demande)) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [demande.reference, demande.direction?.nom, demande.service?.nom, demande.statut]
        .some((value) => value?.toLocaleLowerCase().includes(term));
    });
  });
  protected readonly selectedCourse = computed(() =>
    this.editableCourses().find((course) => course.id === this.selectedCourseId()) ?? null,
  );
  protected readonly hasAllVisibleSelected = computed(() => {
    const visibles = this.visibleDemandes();
    return visibles.length > 0 && visibles.every((demande) => this.selectedDemandeIds().has(demande.id));
  });
  protected readonly hasSomeVisibleSelected = computed(() =>
    this.visibleDemandes().some((demande) => this.selectedDemandeIds().has(demande.id)),
  );
  protected readonly hasSelectionChanges = computed(() => {
    const course = this.selectedCourse();
    if (!course) {
      return false;
    }
    const currentIds = new Set(course.demande_ids);
    const selectedIds = this.selectedDemandeIds();
    return currentIds.size !== selectedIds.size || [...currentIds].some((id) => !selectedIds.has(id));
  });
  protected readonly loadingDemandes = signal(false);
  protected readonly loadingCourses = signal(false);
  protected readonly saving = signal(false);
  protected readonly pendingError = signal('');
  protected readonly courseError = signal('');
  protected readonly successMessage = signal('');

  ngOnInit(): void {
    this.reload();
  }

  protected consulter(demande: TreatmentDemande): void {
    void this.router.navigate(['/dashboard/demandes', demande.id], { queryParams: { source: 'traitement' } });
  }

  protected showMiniFiche(demande: TreatmentDemande): void {
    if (this.selectedDemandeDetail()?.id === demande.id || this.loadingDemandeDetail()) {
      return;
    }
    this.selectedDemandeDetail.set(null);
    this.demandeDetailError.set('');
    this.loadingDemandeDetail.set(true);
    this.api.get<ApiItem<DemandeDetail>>(`/traitement/demandes/${demande.id}`).subscribe({
      next: (response) => {
        this.selectedDemandeDetail.set(response.data);
        this.loadingDemandeDetail.set(false);
      },
      error: (error: unknown) => {
        this.demandeDetailError.set(this.errorMessage(error, 'Impossible de charger la fiche de cette demande.', 'read_demande_traitement'));
        this.loadingDemandeDetail.set(false);
      },
    });
  }

  protected closeMiniFiche(): void {
    this.selectedDemandeDetail.set(null);
    this.demandeDetailError.set('');
  }

  protected ouvrirCourse(): void {
    const demande = this.selectedDemandeDetail();
    if (demande) {
      const demandeIds = this.selectedDemandeIds().has(demande.id)
        ? [...this.selectedDemandeIds()]
        : [demande.id];
      void this.router.navigate(['/dashboard/gestion/courses/nouvelle'], { queryParams: { demandeIds: demandeIds.join(',') } });
    }
  }

  protected preparerCourseAvecSelection(): void {
    const demandeIds = [...this.selectedDemandeIds()];
    if (demandeIds.length === 0) return;
    void this.router.navigate(['/dashboard/gestion/courses/nouvelle'], { queryParams: { demandeIds: demandeIds.join(',') } });
  }

  protected reload(): void {
    this.loadDemandes();
    this.loadCourses();
  }

  protected changeSearch(value: string): void {
    this.searchTerm.set(value);
  }

  protected changeTab(tab: 'all' | 'urgent' | 'priority' | 'selected'): void {
    this.activeTab.set(tab);
  }

  protected priorityOf(demande: TreatmentDemande): DemandePriority {
    const override = this.priorityOverrides().get(demande.id);
    if (override) {
      return override;
    }

    const priority = demande.priorite?.trim().toLocaleUpperCase();
    const urgency = typeof demande.urgence === 'string' ? demande.urgence.trim().toLocaleUpperCase() : demande.urgence;
    if (urgency === true || urgency === 'URGENT' || urgency === 'URGENTE' || priority === 'URGENT' || priority === 'URGENTE') {
      return 'URGENTE';
    }
    return priority === 'PRIORITAIRE' || urgency === 'PRIORITAIRE' ? 'PRIORITAIRE' : 'NORMALE';
  }

  protected setPriority(demande: TreatmentDemande, value: string): void {
    if (value !== 'NORMALE' && value !== 'PRIORITAIRE' && value !== 'URGENTE') {
      return;
    }

    this.priorityOverrides.update((current) => new Map(current).set(demande.id, value));
    const updatedDemande = { ...demande, priorite: value };
    this.demandes.update((items) => items.map((item) => item.id === demande.id ? updatedDemande : item));
    this.demandeCache.update((cache) => new Map(cache).set(demande.id, updatedDemande));
    this.priorityLocalNotice.set(true);
  }

  protected selectCourse(value: string): void {
    const id = value ? Number(value) : null;
    this.selectedCourseId.set(id);
    const course = this.editableCourses().find((item) => item.id === id);
    this.selectedDemandeIds.set(new Set(course?.demande_ids ?? []));
    this.successMessage.set('');
    this.courseError.set('');
  }

  protected isSelected(demandeId: number): boolean {
    return this.selectedDemandeIds().has(demandeId);
  }

  protected toggleDemande(demandeId: number, checked: boolean): void {
    const next = new Set(this.selectedDemandeIds());
    if (checked) {
      next.add(demandeId);
    } else {
      next.delete(demandeId);
    }
    this.selectedDemandeIds.set(next);
    this.successMessage.set('');
  }

  protected toggleVisibleDemandes(checked: boolean): void {
    const next = new Set(this.selectedDemandeIds());
    for (const demande of this.visibleDemandes()) {
      if (checked) {
        next.add(demande.id);
      } else {
        next.delete(demande.id);
      }
    }
    this.selectedDemandeIds.set(next);
    this.successMessage.set('');
  }

  protected removeSelectedDemande(demandeId: number): void {
    this.toggleDemande(demandeId, false);
  }

  protected clearSelection(): void {
    this.selectedDemandeIds.set(new Set());
    this.successMessage.set('');
  }

  protected createPreparation(): void {
    this.courseError.set('');
    this.successMessage.set('');
    this.saving.set(true);
    this.api.post<ApiItem<CoursePreparation>>('/courses', {}, {
      headers: { 'Idempotency-Key': this.newIdempotencyKey() },
    }).subscribe({
      next: (response) => {
        this.courses.update((items) => [response.data, ...items.filter((item) => item.id !== response.data.id)]);
        this.selectedCourseId.set(response.data.id);
        this.selectedDemandeIds.set(new Set(response.data.demande_ids));
        this.successMessage.set('Préparation créée. Sélectionnez les demandes à y inclure, puis enregistrez.');
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.courseError.set(this.errorMessage(error, 'Impossible de créer la préparation de course.', 'create_course'));
        this.saving.set(false);
      },
    });
  }

  protected savePreparation(): void {
    const course = this.selectedCourse();
    if (!course || this.saving()) {
      return;
    }

    this.courseError.set('');
    this.successMessage.set('');
    this.saving.set(true);
    const demandeIds = [...this.selectedDemandeIds()].sort((a, b) => a - b);
    this.api.put<ApiItem<CoursePreparation>>('/courses/' + course.id, {
      version_attendue: course.lock_version,
      demande_ids: demandeIds,
    }, {
      headers: { 'Idempotency-Key': this.newIdempotencyKey() },
    }).subscribe({
      next: (response) => {
        this.courses.update((items) => items.map((item) => item.id === response.data.id ? response.data : item));
        this.successMessage.set('La sélection de demandes a été enregistrée dans la préparation.');
        this.saving.set(false);
      },
      error: (error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 409) {
          this.loadCourses();
          this.loadDemandes();
        }
        this.courseError.set(status === 409
          ? 'La préparation ou une demande a changé depuis son chargement. Les données ont été actualisées ; vérifiez la sélection puis réessayez.'
          : this.errorMessage(error, 'Impossible d’enregistrer la préparation.', 'update_course'));
        this.saving.set(false);
      },
    });
  }

  protected previousPage(): void {
    if (this.page() > 1) {
      this.page.update((value) => value - 1);
      this.loadDemandes();
    }
  }

  protected nextPage(): void {
    if (this.page() < this.lastPage()) {
      this.page.update((value) => value + 1);
      this.loadDemandes();
    }
  }

  protected loadDemandes(): void {
    this.loadingDemandes.set(true);
    this.pendingError.set('');
    this.successMessage.set('');
    const params = new HttpParams().set('page', this.page()).set('per_page', 20);

    this.api.get<ApiList<TreatmentDemande>>('/traitement/demandes', { params }).subscribe({
      next: (response) => {
        const demandes = response.data ?? [];
        this.demandes.set(demandes);
        this.demandeCache.update((cache) => {
          const updated = new Map(cache);
          for (const demande of demandes) {
            updated.set(demande.id, demande);
          }
          return updated;
        });
        this.page.set(response.meta?.current_page ?? this.page());
        this.lastPage.set(response.meta?.last_page ?? 1);
        this.totalDemandes.set(response.meta?.total ?? response.data?.length ?? 0);
        this.loadingDemandes.set(false);
      },
      error: (error: unknown) => {
        this.pendingError.set(this.errorMessage(error, 'Impossible de charger les demandes en attente.', 'read_demande_traitement'));
        this.loadingDemandes.set(false);
      },
    });
  }

  private loadCourses(): void {
    this.loadingCourses.set(true);
    this.courseError.set('');
    this.api.get<ApiList<CoursePreparation>>('/courses', {
      params: { page: '1', per_page: '100' },
    }).subscribe({
      next: (response) => {
        this.courses.set(response.data ?? []);
        const selectedId = this.selectedCourseId();
        if (selectedId !== null) {
          const updated = response.data?.find((item) => item.id === selectedId && item.statut_execution === null);
          if (updated) {
            this.selectedDemandeIds.set(new Set(updated.demande_ids));
          } else {
            this.selectedCourseId.set(null);
            this.selectedDemandeIds.set(new Set());
          }
        }
        this.loadingCourses.set(false);
      },
      error: (error: unknown) => {
        this.courseError.set(this.errorMessage(error, 'Impossible de charger les préparations de course.', 'read_course'));
        this.loadingCourses.set(false);
      },
    });
  }

  private newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
  }

  protected statutLabel(statut: string): string {
    const labels: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      REVALIDATION_REQUISE: 'Revalidation requise',
      BROUILLON: 'Brouillon',
      VALIDEE: 'Validée',
      APPROUVEE: 'Approuvée',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminée',
      ANNULEE: 'Annulée',
      REFUSEE: 'Refusée',
    };
    return labels[statut?.toUpperCase()] ?? statut;
  }

  protected isUrgent(demande: TreatmentDemande): boolean {
    return this.priorityOf(demande) === 'URGENTE';
  }

  protected isPriority(demande: TreatmentDemande): boolean {
    return this.priorityOf(demande) === 'PRIORITAIRE';
  }

  protected statutClass(statut: string): string {
    switch (statut?.toUpperCase()) {
      case 'VALIDEE':
      case 'APPROUVEE':
      case 'TERMINEE':
        return 'status-pill--success';
      case 'REFUSEE':
      case 'ANNULEE':
        return 'status-pill--danger';
      case 'EN_ATTENTE':
      case 'REVALIDATION_REQUISE':
        return 'status-pill--pending';
      default:
        return 'status-pill--neutral';
    }
  }

  private errorMessage(error: unknown, fallback: string, requiredPermission?: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403 && requiredPermission) {
        return `Accès refusé : votre compte ne dispose pas de la permission « ${requiredPermission} ».`;
      }
      if (error.status === 401) {
        return 'Votre session a expiré. Reconnectez-vous pour poursuivre.';
      }
      if (error.status === 0) {
        return 'Le serveur API est injoignable. Vérifiez votre connexion puis réessayez.';
      }
    }
    const message = (error as { error?: { message?: string } })?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
