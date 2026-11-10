import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { isEligibleChauffeurAccount, User } from '../../../administration/models/user.model';
import { UserService } from '../../../administration/services/user.service';

@Component({
  selector: 'app-chauffeurs-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './chauffeurs.page.html',
  styleUrl: './chauffeurs.page.scss',
})
export class ChauffeursPage {
  private readonly usersApi = inject(UserService);
  private readonly perPage = 10;

  protected readonly chauffeurs = signal<User[]>([]);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly errorMessage = signal('');
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
    this.usersApi.list({
      search: this.filtersForm.controls.search.value,
      page: this.currentPage(),
      perPage: this.perPage,
      role: 'chauffeur',
    }).subscribe({
      next: (response) => {
        const chauffeurs = response.data.filter(isEligibleChauffeurAccount);
        this.chauffeurs.set(chauffeurs);
        this.total.set(chauffeurs.length);
        this.lastPage.set(Math.max(1, response.meta.last_page));
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

  protected fullName(chauffeur: User): string {
    return `${chauffeur.prenom} ${chauffeur.nom}`.trim();
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
}
