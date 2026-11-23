import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';

import { ApiService } from '@/core/services/api.service';

interface DriverAccount {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  statut: 'ACTIF' | 'INACTIF';
  must_change_password: boolean;
}

interface DriverProfile {
  id: number;
  user_id: number | null;
  telephone: string | null;
  statut: 'ACTIF' | 'INACTIF';
  lock_version: number;
}

interface DriverProfileListResponse {
  data: DriverProfile[];
}

interface DriverAccountListResponse {
  data: DriverAccount[];
  meta: { total: number; last_page: number };
}

interface DriverCourse {
  id: number;
  statut_execution: string | null;
  chauffeur_id: number | null;
  plan?: { occupation_debut_prevue?: string | null; occupation_fin_prevue?: string | null } | null;
}

interface DriverCourseListResponse {
  data: DriverCourse[];
  meta?: { current_page: number; last_page: number; total: number };
}

@Component({
  selector: 'app-chauffeurs-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chauffeurs.page.html',
  styleUrl: './chauffeurs.page.scss',
})
export class ChauffeursPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly perPage = 10;

  protected readonly chauffeurs = signal<DriverAccount[]>([]);
  protected readonly profils = signal<DriverProfile[]>([]);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly profileActionUserId = signal<number | null>(null);
  protected readonly profileCreateTarget = signal<DriverAccount | null>(null);
  protected readonly profileTelephone = signal('');
  protected readonly profileCreateError = signal('');
  protected readonly profileEditMode = signal(false);
  protected readonly coursesParChauffeur = signal(new Map<number, DriverCourse[]>());
  protected readonly coursesIndisponibles = signal(false);
  protected readonly coursesEnChargement = signal(true);
  protected readonly historyTarget = signal<DriverAccount | null>(null);
  protected readonly historyCourses = signal<DriverCourse[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  private coursesChargees = false;
  private coursesChargementDemarre = false;
  protected readonly filtersForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.loadChauffeurs();
    this.filtersForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.search());
  }

  protected loadChauffeurs(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    forkJoin({
      accounts: this.api.get<DriverAccountListResponse>(
        `/parametrage/chauffeurs/comptes?page=${this.currentPage()}&per_page=${this.perPage}&search=${encodeURIComponent(this.filtersForm.controls.search.value)}`,
      ),
      profiles: this.api.get<DriverProfileListResponse>('/parametrage/chauffeurs?page=1&per_page=100'),
    }).subscribe({
      next: ({ accounts, profiles }) => {
        this.chauffeurs.set(accounts.data ?? []);
        this.profils.set(profiles.data ?? []);
        this.total.set(accounts.meta.total);
        this.lastPage.set(Math.max(1, accounts.meta.last_page));
        this.loading.set(false);
        if (!this.coursesChargees && !this.coursesChargementDemarre && !this.coursesIndisponibles()) this.chargerCourses(1, []);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.errorText(error, 'Impossible de charger le registre des chauffeurs.'));
      },
    });
  }

  protected search(): void {
    this.currentPage.set(1);
    this.loadChauffeurs();
  }

  protected changePage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadChauffeurs();
  }

  protected fullName(chauffeur: DriverAccount): string {
    return `${chauffeur.prenom} ${chauffeur.nom}`.trim();
  }

  protected coursesActives(chauffeur: DriverAccount): DriverCourse[] {
    return (this.coursesParChauffeur().get(chauffeur.id) ?? [])
      .filter((course) => course.statut_execution === 'A_VENIR' || course.statut_execution === 'EN_COURS');
  }

  protected courseStatusLabel(chauffeur: DriverAccount): string {
    if (this.coursesIndisponibles()) return 'Indisponible';
    if (this.coursesEnChargement()) return 'Vérification…';
    const active = this.coursesActives(chauffeur);
    if (active.some((course) => course.statut_execution === 'EN_COURS')) return 'En course';
    if (active.length) return 'Course planifiée';
    return 'Aucune course';
  }

  protected courseStatusClass(chauffeur: DriverAccount): string {
    if (this.coursesIndisponibles()) return 'status-pill status-pill--off';
    if (this.coursesEnChargement()) return 'status-pill status-pill--loading';
    const active = this.coursesActives(chauffeur);
    if (active.some((course) => course.statut_execution === 'EN_COURS')) return 'status-pill status-pill--running';
    return active.length ? 'status-pill status-pill--scheduled' : 'status-pill status-pill--off';
  }

  protected ouvrirHistorique(chauffeur: DriverAccount): void {
    this.historyTarget.set(chauffeur);
    this.historyCourses.set(this.coursesParChauffeur().get(chauffeur.id) ?? []);
    this.historyError.set('');
    this.historyLoading.set(!this.coursesChargees && !this.coursesIndisponibles());
    if (!this.coursesChargees && !this.coursesChargementDemarre && !this.coursesIndisponibles()) this.chargerCourses(1, []);
    if (this.coursesIndisponibles()) this.historyError.set('Impossible de charger l’historique des courses.');
  }

  protected fermerHistorique(): void {
    this.historyTarget.set(null);
    this.historyError.set('');
  }

  protected courseLabel(course: DriverCourse): string {
    switch (course.statut_execution) {
      case 'A_VENIR': return 'Validée · à venir';
      case 'EN_COURS': return 'En cours';
      case 'TERMINEE': return 'Terminée';
      case 'ANNULEE': return 'Annulée';
      default: return 'Brouillon';
    }
  }

  protected courseClass(course: DriverCourse): string {
    if (course.statut_execution === 'EN_COURS') return 'status-pill status-pill--running';
    if (course.statut_execution === 'A_VENIR') return 'status-pill status-pill--scheduled';
    if (course.statut_execution === 'TERMINEE') return 'status-pill';
    return 'status-pill status-pill--off';
  }

  protected ouvrirCourse(course: DriverCourse): void {
    void this.router.navigate(['/dashboard/gestion/courses', course.id]);
  }

  private chargerCourses(page: number, courses: DriverCourse[]): void {
    this.coursesChargementDemarre = true;
    this.coursesEnChargement.set(true);
    this.api.get<DriverCourseListResponse>(`/courses?page=${page}&per_page=100`).subscribe({
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
        const grouped = new Map<number, DriverCourse[]>();
        for (const course of allCourses) {
          if (course.chauffeur_id === null) continue;
          grouped.set(course.chauffeur_id, [...(grouped.get(course.chauffeur_id) ?? []), course]);
        }
        this.coursesParChauffeur.set(grouped);
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

  protected profilChauffeur(userId: number): DriverProfile | undefined {
    return this.profils().find((profile) => profile.user_id === userId);
  }

  protected creerOuActiverProfil(chauffeur: DriverAccount): void {
    if (this.profileActionUserId() !== null) return;

    const profile = this.profilChauffeur(chauffeur.id);
    if (profile?.statut === 'ACTIF') return;

    if (!profile) {
      this.profileEditMode.set(false);
      this.profileTelephone.set('');
      this.profileCreateError.set('');
      this.profileCreateTarget.set(chauffeur);
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.profileActionUserId.set(chauffeur.id);

    const request = this.api.put(`/parametrage/chauffeurs/${profile.id}/activate`, {
      version_attendue: profile.lock_version,
      motif: 'Activation du profil chauffeur pour permettre son affectation aux courses.',
    }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } });

    request.subscribe({
      next: () => {
        this.profileActionUserId.set(null);
        this.successMessage.set(`Le profil chauffeur de ${this.fullName(chauffeur)} est actif.`);
        this.loadChauffeurs();
      },
      error: (error: unknown) => {
        this.profileActionUserId.set(null);
        this.errorMessage.set(this.errorText(error, 'Impossible d’enregistrer le profil chauffeur.'));
      },
    });
  }

  protected closeProfileCreate(): void {
    if (this.profileActionUserId() !== null) return;
    this.profileCreateTarget.set(null);
    this.profileCreateError.set('');
    this.profileEditMode.set(false);
  }

  protected modifierTelephone(chauffeur: DriverAccount): void {
    const profile = this.profilChauffeur(chauffeur.id);
    if (!profile || this.profileActionUserId() !== null) return;
    this.profileEditMode.set(true);
    this.profileTelephone.set(profile.telephone ?? '');
    this.profileCreateError.set('');
    this.profileCreateTarget.set(chauffeur);
  }

  protected saveProfile(): void {
    const chauffeur = this.profileCreateTarget();
    if (!chauffeur || this.profileActionUserId() !== null) return;
    const telephone = this.profileTelephone().trim();
    if (telephone && !/^\+?(?=[0-9 ().-]*[0-9])[0-9 ().-]+$/.test(telephone)) {
      this.profileCreateError.set('Saisissez un numéro de téléphone valide.');
      return;
    }
    this.profileCreateError.set('');
    this.profileActionUserId.set(chauffeur.id);
    const profile = this.profilChauffeur(chauffeur.id);
    const editing = this.profileEditMode() && !!profile;
    const request = editing && profile
      ? this.api.put(`/parametrage/chauffeurs/${profile.id}`, {
          version_attendue: profile.lock_version,
          telephone: telephone || null,
        }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } })
      : this.api.post('/parametrage/chauffeurs', {
          user_id: chauffeur.id,
          ...(telephone ? { telephone } : {}),
        }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } });
    request.subscribe({
      next: () => {
        this.profileActionUserId.set(null);
        this.profileCreateTarget.set(null);
        this.successMessage.set(editing
          ? `Le téléphone de ${this.fullName(chauffeur)} a été mis à jour.`
          : `Le profil chauffeur de ${this.fullName(chauffeur)} est actif.`);
        this.profileEditMode.set(false);
        this.loadChauffeurs();
      },
      error: (error: unknown) => {
        this.profileActionUserId.set(null);
        this.profileCreateError.set(this.errorText(error, 'Impossible d’enregistrer le profil chauffeur.'));
      },
    });
  }

  private errorText(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
    if (error.status === 403) {
      return 'L’API refuse la lecture des comptes chauffeur. Vérifiez les permissions de votre rôle.';
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
    if (error.status === 422) return 'Les informations saisies ne sont pas valides.';
    return fallback;
  }

  private newIdempotencyKey(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
          const random = Math.floor(Math.random() * 16);
          return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
        });
  }
}
