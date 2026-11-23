import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { ApiService } from '@/core/services/api.service';
import { Vehicule, VehiculeService } from '../../services/vehicule.service';

interface VehicleCourse {
  id: number;
  statut_execution: string | null;
  vehicule_id: number | null;
  plan?: { occupation_debut_prevue?: string | null; occupation_fin_prevue?: string | null } | null;
}

interface VehicleCourseListResponse {
  data: VehicleCourse[];
  meta?: { current_page: number; last_page: number; total: number };
}

@Component({
  selector: 'app-vehicules-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './vehicules.page.html',
  styleUrl: './vehicules.page.scss',
})
export class VehiculesPage {
  private readonly api = inject(VehiculeService);
  private readonly courseApi = inject(ApiService);
  private readonly router = inject(Router);
  private readonly perPage = 10;

  protected readonly vehicles = signal<Vehicule[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly coursesParVehicule = signal(new Map<number, VehicleCourse[]>());
  protected readonly coursesIndisponibles = signal(false);
  protected readonly coursesEnChargement = signal(true);
  protected readonly historyTarget = signal<Vehicule | null>(null);
  protected readonly historyCourses = signal<VehicleCourse[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  private coursesChargees = false;
  private coursesChargementDemarre = false;

  protected readonly filtersForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
  });

  protected readonly createForm = new FormGroup({
    immatriculation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(30)],
    }),
    places_utiles: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
    marque: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
    modele: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
  });

  constructor() {
    this.loadVehicles();
    this.filtersForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.search());
  }

  protected loadVehicles(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.list({
      search: this.filtersForm.controls.search.value,
      page: this.currentPage(),
      perPage: this.perPage,
    }).subscribe({
      next: (response) => {
        this.vehicles.set(response.data);
        this.total.set(response.meta.total);
        this.lastPage.set(Math.max(1, response.meta.last_page));
        this.loading.set(false);
        if (!this.coursesChargees && !this.coursesChargementDemarre && !this.coursesIndisponibles()) this.chargerCourses(1, []);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.errorText(error, 'Impossible de charger le parc automobile.', 'read_vehicle'));
      },
    });
  }

  protected search(): void {
    this.currentPage.set(1);
    this.loadVehicles();
  }

  protected changePage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadVehicles();
  }

  protected coursesActives(vehicle: Vehicule): VehicleCourse[] {
    return (this.coursesParVehicule().get(vehicle.id) ?? [])
      .filter((course) => course.statut_execution === 'A_VENIR' || course.statut_execution === 'EN_COURS');
  }

  protected courseStatusLabel(vehicle: Vehicule): string {
    if (this.coursesIndisponibles()) return 'Indisponible';
    if (this.coursesEnChargement()) return 'Vérification…';
    const active = this.coursesActives(vehicle);
    if (active.some((course) => course.statut_execution === 'EN_COURS')) return 'En course';
    return active.length ? 'Course planifiée' : 'Aucune course';
  }

  protected courseStatusClass(vehicle: Vehicule): string {
    if (this.coursesIndisponibles()) return 'status-pill status-pill--off';
    if (this.coursesEnChargement()) return 'status-pill status-pill--loading';
    const active = this.coursesActives(vehicle);
    if (active.some((course) => course.statut_execution === 'EN_COURS')) return 'status-pill status-pill--running';
    return active.length ? 'status-pill status-pill--scheduled' : 'status-pill status-pill--off';
  }

  protected ouvrirHistorique(vehicle: Vehicule): void {
    this.historyTarget.set(vehicle);
    this.historyCourses.set(this.coursesParVehicule().get(vehicle.id) ?? []);
    this.historyError.set('');
    this.historyLoading.set(!this.coursesChargees && !this.coursesIndisponibles());
    if (!this.coursesChargees && !this.coursesChargementDemarre && !this.coursesIndisponibles()) this.chargerCourses(1, []);
    if (this.coursesIndisponibles()) this.historyError.set('Impossible de charger l’historique des courses.');
  }

  protected fermerHistorique(): void {
    this.historyTarget.set(null);
    this.historyError.set('');
  }

  protected courseLabel(course: VehicleCourse): string {
    switch (course.statut_execution) {
      case 'A_VENIR': return 'Validée · à venir';
      case 'EN_COURS': return 'En cours';
      case 'TERMINEE': return 'Terminée';
      case 'ANNULEE': return 'Annulée';
      default: return 'Brouillon';
    }
  }

  protected courseClass(course: VehicleCourse): string {
    if (course.statut_execution === 'EN_COURS') return 'status-pill status-pill--running';
    if (course.statut_execution === 'A_VENIR') return 'status-pill status-pill--scheduled';
    if (course.statut_execution === 'TERMINEE') return 'status-pill';
    return 'status-pill status-pill--off';
  }

  protected ouvrirCourse(course: VehicleCourse): void {
    void this.router.navigate(['/dashboard/gestion/courses', course.id]);
  }

  private chargerCourses(page: number, courses: VehicleCourse[]): void {
    this.coursesChargementDemarre = true;
    this.coursesEnChargement.set(true);
    this.courseApi.get<VehicleCourseListResponse>(`/courses?page=${page}&per_page=100`).subscribe({
      next: (response) => {
        const allCourses = [...courses, ...(response.data ?? [])];
        const lastPage = response.meta?.last_page ?? page;
        if (page < lastPage) {
          this.chargerCourses(page + 1, allCourses);
          return;
        }
        this.coursesChargees = true;
        this.coursesEnChargement.set(false);
        this.coursesIndisponibles.set(false);
        const grouped = new Map<number, VehicleCourse[]>();
        for (const course of allCourses) {
          if (course.vehicule_id === null) continue;
          grouped.set(course.vehicule_id, [...(grouped.get(course.vehicule_id) ?? []), course]);
        }
        this.coursesParVehicule.set(grouped);
        const target = this.historyTarget();
        if (target) {
          this.historyCourses.set(grouped.get(target.id) ?? []);
          this.historyLoading.set(false);
        }
      },
      error: () => {
        this.coursesEnChargement.set(false);
        this.coursesIndisponibles.set(true);
        this.historyLoading.set(false);
        this.historyError.set('Impossible de charger l’historique des courses.');
      },
    });
  }

  protected openCreate(): void {
    this.createForm.reset({ immatriculation: '', places_utiles: 1, marque: '', modele: '' });
    this.createForm.enable();
    this.errorMessage.set('');
    this.editorOpen.set(true);
  }

  protected closeCreate(): void {
    if (this.saving()) return;
    this.editorOpen.set(false);
    this.errorMessage.set('');
  }

  protected createVehicle(): void {
    if (this.saving()) return;
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { immatriculation, places_utiles, marque, modele } = this.createForm.getRawValue();

    this.saving.set(true);
    this.createForm.disable();
    this.errorMessage.set('');
    this.api.create({
      immatriculation: immatriculation.trim().toUpperCase(),
      places_utiles,
      marque: marque.trim() || null,
      modele: modele.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.successMessage.set('Le véhicule a été ajouté au parc.');
        this.currentPage.set(1);
        this.loadVehicles();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.createForm.enable();
        this.errorMessage.set(this.errorText(error, 'Impossible d’ajouter le véhicule.', 'create_vehicle'));
      },
    });
  }

  protected fieldError(field: 'immatriculation' | 'places_utiles' | 'marque' | 'modele'): string {
    const control = this.createForm.controls[field];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Ce champ est obligatoire.';
    if (control.hasError('maxlength')) {
      return field === 'immatriculation' ? 'L’immatriculation ne peut pas dépasser 30 caractères.' : 'Ce champ ne peut pas dépasser 255 caractères.';
    }
    if (control.hasError('min') || control.hasError('max')) return 'Le nombre de places doit être compris entre 1 et 100.';
    return '';
  }

  private errorText(error: unknown, fallback: string, permission: 'read_vehicle' | 'create_vehicle'): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
    if (error.status === 403) {
      return `L’API refuse cette opération : la permission « ${permission} » n’est pas attribuée à votre rôle.`;
    }
    const body: unknown = error.error;
    if (body && typeof body === 'object') {
      if ('message' in body && typeof body.message === 'string') return body.message;
      if ('errors' in body && body.errors && typeof body.errors === 'object') {
        const messages = Object.values(body.errors).flatMap((value) =>
          Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
        );
        if (messages.length) return messages.join(' ');
      }
    }
    if (error.status === 409) return 'Un véhicule avec cette immatriculation existe déjà.';
    if (error.status === 422) return 'Les informations saisies ne sont pas valides.';
    return fallback;
  }
}
