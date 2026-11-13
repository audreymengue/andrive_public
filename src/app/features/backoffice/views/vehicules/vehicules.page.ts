import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Vehicule, VehiculeService } from '../../services/vehicule.service';

@Component({
  selector: 'app-vehicules-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './vehicules.page.html',
  styleUrl: './vehicules.page.scss',
})
export class VehiculesPage {
  private readonly api = inject(VehiculeService);
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

  protected readonly filtersForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
  });

  protected readonly createForm = new FormGroup({
    immatriculation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(30)],
    }),
    marque: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    modele: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
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

  protected openCreate(): void {
    this.createForm.reset({ immatriculation: '', marque: '', modele: '' });
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

    const { immatriculation, marque, modele } = this.createForm.getRawValue();

    this.saving.set(true);
    this.createForm.disable();
    this.errorMessage.set('');
    this.api.create({
      immatriculation: immatriculation.trim().toUpperCase(),
      marque: marque.trim(),
      modele: modele.trim(),
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

  protected fieldError(field: 'immatriculation' | 'marque' | 'modele'): string {
    const control = this.createForm.controls[field];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Ce champ est obligatoire.';
    if (control.hasError('maxlength')) {
      return field === 'immatriculation'
        ? 'L’immatriculation ne peut pas dépasser 30 caractères.'
        : 'Ce champ ne peut pas dépasser 100 caractères.';
    }
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
