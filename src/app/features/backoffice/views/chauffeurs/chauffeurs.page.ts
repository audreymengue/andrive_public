import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { User } from '../../../administration/models/user.model';
import { UserService } from '../../../administration/services/user.service';
import { ChauffeurService, ProfilChauffeur, StatutProfilChauffeur } from '../../services/chauffeur.service';

@Component({
  selector: 'app-chauffeurs-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chauffeurs.page.html',
  styleUrl: './chauffeurs.page.scss',
})
export class ChauffeursPage {
  private readonly api = inject(ChauffeurService);
  private readonly usersApi = inject(UserService);
  private readonly perPage = 10;

  protected readonly profiles = signal<ProfilChauffeur[]>([]);
  protected readonly accounts = signal<User[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingAccounts = signal(false);
  protected readonly saving = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly errorMessage = signal('');
  protected readonly emailErrorMessage = signal('');
  protected readonly accountError = signal('');
  protected readonly successMessage = signal('');
  protected readonly filtersForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    status: new FormControl<'' | StatutProfilChauffeur>('', { nonNullable: true }),
  });
  protected readonly createForm = new FormGroup({
    userId: new FormControl<number | null>({ value: null, disabled: true }),
  });

  constructor() {
    this.loadProfiles();
  }

  protected loadProfiles(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.list({
      search: this.filtersForm.controls.search.value,
      statut: this.filtersForm.controls.status.value || undefined,
      page: this.currentPage(),
      perPage: this.perPage,
    }).subscribe({
      next: (response) => {
        this.profiles.set(response.data);
        this.total.set(response.meta?.total ?? response.data.length);
        this.lastPage.set(Math.max(1, response.meta?.last_page ?? 1));
        this.loadMissingEmails(response.data);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.errorText(error, 'Impossible de charger le registre des chauffeurs.', 'read_driver'));
      },
    });
  }

  protected search(): void {
    this.currentPage.set(1);
    this.loadProfiles();
  }

  protected changeStatusFilter(): void {
    this.currentPage.set(1);
    this.loadProfiles();
  }

  protected changePage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadProfiles();
  }

  protected openCreate(): void {
    const userIdControl = this.createForm.controls.userId;
    userIdControl.reset(null);
    userIdControl.disable();
    this.accountError.set('');
    this.errorMessage.set('');
    this.editorOpen.set(true);
    this.loadingAccounts.set(true);
    this.usersApi.list({ role: 'chauffeur', page: 1, perPage: 100 }).subscribe({
      next: (response) => {
        this.accounts.set(response.data);
        this.loadingAccounts.set(false);
        userIdControl.enable();
      },
      error: (error: unknown) => {
        this.loadingAccounts.set(false);
        this.accountError.set(this.errorText(error, 'Impossible de charger les comptes chauffeur.'));
        userIdControl.enable();
      },
    });
  }

  protected closeCreate(): void {
    if (this.saving()) return;
    this.editorOpen.set(false);
    this.errorMessage.set('');
  }

  protected createProfile(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.createForm.controls.userId.disable();
    this.errorMessage.set('');
    this.api.create({ user_id: this.createForm.controls.userId.value }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.successMessage.set('Le profil chauffeur a été créé.');
        this.currentPage.set(1);
        this.loadProfiles();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.createForm.controls.userId.enable();
        this.errorMessage.set(this.errorText(error, 'Impossible de créer le profil chauffeur.', 'create_driver'));
      },
    });
  }

  protected fullName(profile: ProfilChauffeur): string {
    const account = this.accountOf(profile);
    if (!account) return 'Profil sans compte lié';
    const name = `${account.prenom ?? ''} ${account.nom ?? ''}`.trim();
    return name || `Compte #${account.id ?? profile.user_id}`;
  }

  protected email(profile: ProfilChauffeur): string {
    return this.accountOf(profile)?.email || (profile.user_id === null ? '—' : 'E-mail indisponible');
  }

  protected accountStatus(profile: ProfilChauffeur): StatutProfilChauffeur | 'LIE' | null {
    return this.accountOf(profile)?.statut ?? (profile.user_id === null ? null : 'LIE');
  }

  private accountOf(profile: ProfilChauffeur): ProfilChauffeur['utilisateur'] | ProfilChauffeur['user'] {
    return profile.utilisateur ?? profile.user ?? null;
  }

  private loadMissingEmails(profiles: ProfilChauffeur[]): void {
    const profilesWithoutEmail = profiles.filter((profile) =>
      profile.user_id !== null && !this.accountOf(profile)?.email,
    );
    if (profilesWithoutEmail.length === 0) {
      this.emailErrorMessage.set('');
      this.loading.set(false);
      return;
    }

    forkJoin(profilesWithoutEmail.map((profile) => this.usersApi.get(profile.user_id!))).subscribe({
      next: (accounts) => {
        const accountsById = new Map(accounts.map((account) => [account.id, account]));
        this.profiles.update((currentProfiles) => currentProfiles.map((profile) => {
          const account = profile.user_id === null ? undefined : accountsById.get(profile.user_id);
          if (!account) return profile;

          const linkedAccount = this.accountOf(profile) ?? {};
          return {
            ...profile,
            utilisateur: {
              ...linkedAccount,
              email: account.email,
            },
          };
        }));
        this.emailErrorMessage.set('');
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.emailErrorMessage.set(this.errorText(
          error,
          'Les adresses e-mail des comptes liés n’ont pas pu être chargées.',
        ));
        this.loading.set(false);
      },
    });
  }

  private errorText(error: unknown, fallback: string, permission?: 'read_driver' | 'create_driver'): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
    if (error.status === 403) {
      return permission
        ? `L’API refuse cette opération : la permission « ${permission} » n’est pas attribuée à votre rôle. Faites-la ajouter au rôle administrateur, puis reconnectez-vous.`
        : 'L’API refuse cette opération. Vérifiez les permissions de votre rôle.';
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
    if (error.status === 409) return 'Ce compte est déjà lié à un autre profil chauffeur.';
    if (error.status === 422) return 'Les informations saisies ne sont pas valides.';
    return fallback;
  }
}
