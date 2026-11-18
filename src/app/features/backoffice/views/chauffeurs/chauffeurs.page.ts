import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-chauffeurs-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chauffeurs.page.html',
  styleUrl: './chauffeurs.page.scss',
})
export class ChauffeursPage {
  private readonly api = inject(ApiService);
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

  protected profilChauffeur(userId: number): DriverProfile | undefined {
    return this.profils().find((profile) => profile.user_id === userId);
  }

  protected creerOuActiverProfil(chauffeur: DriverAccount): void {
    if (this.profileActionUserId() !== null) return;

    const profile = this.profilChauffeur(chauffeur.id);
    if (profile?.statut === 'ACTIF') return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.profileActionUserId.set(chauffeur.id);

    const request = profile
      ? this.api.put(`/parametrage/chauffeurs/${profile.id}/activate`, {
          version_attendue: profile.lock_version,
          motif: 'Activation du profil chauffeur pour permettre son affectation aux courses.',
        }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } })
      : this.api.post('/parametrage/chauffeurs', { user_id: chauffeur.id }, {
          headers: { 'Idempotency-Key': this.newIdempotencyKey() },
        });

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
