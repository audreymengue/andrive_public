import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
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

interface DirectionOption {
  id: number;
  nom: string;
  code?: string;
}

interface TreatmentDemande {
  id: number;
  reference: string;
  statut: string;
  direction: { id: number; nom: string };
  service: { id: number; nom: string; code: string } | null;
  date_depart: string | null;
  heure_depart: string | null;
}

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
  protected readonly directions = signal<DirectionOption[]>([]);
  protected readonly courses = signal<CoursePreparation[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly totalDemandes = signal(0);
  protected readonly directionId = signal<number | null>(null);
  protected readonly dateDepartFrom = signal('');
  protected readonly dateDepartTo = signal('');
  protected readonly selectedCourseId = signal<number | null>(null);
  protected readonly selectedDemandeIds = signal<Set<number>>(new Set());
  protected readonly selectedCourse = computed(() =>
    this.courses().find((course) => course.id === this.selectedCourseId()) ?? null,
  );
  protected readonly loadingDemandes = signal(false);
  protected readonly loadingCourses = signal(false);
  protected readonly saving = signal(false);
  protected readonly pendingError = signal('');
  protected readonly courseError = signal('');
  protected readonly directionError = signal('');
  protected readonly successMessage = signal('');

  ngOnInit(): void {
    this.reload();
  }

  protected consulter(demande: TreatmentDemande): void {
    void this.router.navigate(['/dashboard/demandes', demande.id], { queryParams: { source: 'traitement' } });
  }

  protected reload(): void {
    this.loadDirections();
    this.loadDemandes();
    this.loadCourses();
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.loadDemandes();
  }

  protected changeDirection(value: string): void {
    this.directionId.set(value ? Number(value) : null);
  }

  protected changeDateFrom(value: string): void {
    this.dateDepartFrom.set(value);
  }

  protected changeDateTo(value: string): void {
    this.dateDepartTo.set(value);
  }

  protected selectCourse(value: string): void {
    const id = value ? Number(value) : null;
    this.selectedCourseId.set(id);
    const course = this.courses().find((item) => item.id === id);
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
        this.courseError.set(this.errorMessage(error, 'Impossible de créer la préparation de course.'));
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
          : this.errorMessage(error, 'Impossible d’enregistrer la préparation.'));
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

  private loadDirections(): void {
    this.directionError.set('');
    this.api.get<ApiList<DirectionOption>>('/directions').subscribe({
      next: (response) => this.directions.set(response.data ?? []),
      error: (error: unknown) => this.directionError.set(this.errorMessage(error, 'Les directions ne sont pas disponibles pour le filtre.')),
    });
  }

  protected loadDemandes(): void {
    this.loadingDemandes.set(true);
    this.pendingError.set('');
    this.successMessage.set('');
    let params = new HttpParams().set('page', this.page()).set('per_page', 20);
    if (this.directionId() !== null) {
      params = params.set('direction_id', this.directionId()!);
    }
    if (this.dateDepartFrom()) {
      params = params.set('date_depart_from', this.dateDepartFrom());
    }
    if (this.dateDepartTo()) {
      params = params.set('date_depart_to', this.dateDepartTo());
    }

    this.api.get<ApiList<TreatmentDemande>>('/traitement/demandes', { params }).subscribe({
      next: (response) => {
        this.demandes.set(response.data ?? []);
        this.page.set(response.meta?.current_page ?? this.page());
        this.lastPage.set(response.meta?.last_page ?? 1);
        this.totalDemandes.set(response.meta?.total ?? response.data?.length ?? 0);
        this.loadingDemandes.set(false);
      },
      error: (error: unknown) => {
        this.pendingError.set(this.errorMessage(error, 'Impossible de charger les demandes en attente.'));
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
          const updated = response.data?.find((item) => item.id === selectedId);
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
        this.courseError.set(this.errorMessage(error, 'Impossible de charger les préparations de course.'));
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

  private errorMessage(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: string } })?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
