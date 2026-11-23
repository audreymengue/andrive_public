import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Signalement, SignalementService, SignalementType, TypeRessource } from '../../services/signalement.service';

@Component({
  selector: 'app-transport-page', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './transport.page.html', styleUrl: './transport.page.scss',
})
export class TransportPage implements OnInit {
  private readonly service = inject(SignalementService);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly items = signal<Signalement[]>([]);
  protected readonly allItems = signal<Signalement[]>([]);
  protected readonly total = signal(0);
  protected readonly lastPage = signal(1);
  protected readonly selected = signal<Signalement | null>(null);
  protected readonly detailsLoading = signal(false);
  protected readonly modal = signal(false);
  protected readonly search = signal('');
  protected readonly resourceFilter = signal<TypeRessource | ''>('');
  protected readonly courseFilter = signal('');
  protected readonly resourceIdFilter = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 10;
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly types: SignalementType[] = ['RETARD', 'PANNE', 'ABSENCE', 'IMPOSSIBILITE', 'INDISPONIBILITE'];
  protected form: { type: SignalementType; type_ressource: TypeRessource; ressource_id: number | null; course_id: number | null; details: string } = this.emptyForm();

  ngOnInit(): void { this.load(); }

  protected get pageItems(): Signalement[] {
    const query = this.search().trim().toLowerCase();
    return this.items().filter(item => !query || [item.id, item.type, item.type_ressource, item.ressource_id, item.course_id, item.details].some(value => String(value ?? '').toLowerCase().includes(query)));
  }
  protected get pages(): number { return this.lastPage(); }
  protected get vehicleCount(): number { return this.allItems().filter(item => item.type_ressource === 'VEHICULE').length; }
  protected get driverCount(): number { return this.allItems().filter(item => item.type_ressource === 'CHAUFFEUR').length; }

  protected load(refreshStats = true): void {
    this.loading.set(true); this.error.set('');
    const courseId = Number(this.courseFilter());
    const resourceId = Number(this.resourceIdFilter());
    this.service.list({
      ...(this.resourceFilter() ? { type_ressource: this.resourceFilter() } : {}),
      ...(courseId > 0 ? { course_id: courseId } : {}),
      ...(resourceId > 0 ? { ressource_id: resourceId } : {}),
      page: this.page(), per_page: this.pageSize,
    }).subscribe({
      next: response => {
        this.items.set(response.data ?? []);
        this.total.set(response.meta?.total ?? response.total ?? (response.data ?? []).length);
        this.lastPage.set(response.meta?.last_page ?? response.last_page ?? 1);
        this.loading.set(false);
      },
      error: err => { this.error.set(this.errorText(err)); this.loading.set(false); },
    });
    if (!refreshStats) return;
    // Les cartes restent fondées sur l'ensemble non filtré des signalements renvoyés par l'API.
    this.service.list({ page: 1, per_page: 100 }).subscribe({
      next: first => {
        const all = [...(first.data ?? [])];
        const last = first.meta?.last_page ?? first.last_page ?? 1;
        const fetchPage = (n: number): void => {
          if (n > last) { this.allItems.set(all); return; }
          this.service.list({ page: n, per_page: 100 }).subscribe({
            next: response => { all.push(...(response.data ?? [])); fetchPage(n + 1); },
            error: err => { this.allItems.set(all); this.error.set(this.errorText(err)); },
          });
        };
        fetchPage(2);
        if (last <= 1) this.allItems.set(all);
      },
      error: err => { this.error.set(this.errorText(err)); },
    });
  }

  protected openCreate(): void { this.form = this.emptyForm(); this.fieldErrors.set({}); this.error.set(''); this.success.set(''); this.modal.set(true); }
  protected closeCreate(): void { if (!this.saving()) this.modal.set(false); }
  protected setFilter(): void { this.page.set(1); this.load(false); }
  protected previous(): void { if (this.page() > 1) { this.page.update(page => page - 1); this.load(false); } }
  protected next(): void { if (this.page() < this.pages) { this.page.update(page => page + 1); this.load(false); } }
  protected detail(item: Signalement): void {
    this.selected.set(item); this.detailsLoading.set(true);
    this.service.get(item.id).subscribe({
      next: response => { this.selected.set(response.data ?? item); this.detailsLoading.set(false); },
      error: err => { this.error.set(this.errorText(err)); this.detailsLoading.set(false); },
    });
  }
  protected closeDetails(): void { this.selected.set(null); this.error.set(''); }

  protected submit(): void {
    this.fieldErrors.set({}); this.error.set(''); this.success.set('');
    const details = this.form.details.trim();
    if (this.form.type_ressource === 'VEHICULE' && !this.form.course_id) {
      this.fieldErrors.set({ course_id: ['Une course actuellement affectée est obligatoire pour signaler un véhicule.'] });
      this.error.set('Sélectionnez la course actuellement affectée au véhicule.');
      return;
    }
    if (!this.form.ressource_id || this.form.ressource_id < 1 || !details || details.length > 1000
      || (this.form.course_id !== null && this.form.course_id < 1)) {
      this.error.set('Vérifiez les champs obligatoires et les valeurs indiquées.'); return;
    }
    const payload = { type: this.form.type, type_ressource: this.form.type_ressource, ressource_id: this.form.ressource_id, ...(this.form.course_id ? { course_id: this.form.course_id } : {}), details };
    this.saving.set(true);
    this.service.create(payload).subscribe({
      next: () => { this.saving.set(false); this.modal.set(false); this.success.set('Le signalement a été enregistré.'); this.page.set(1); this.allItems.set([]); this.load(); },
      error: err => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse && err.status === 422) {
          this.fieldErrors.set((err.error?.errors ?? {}) as Record<string, string[]>);
          this.error.set(err.error?.message || 'Certains champs doivent être corrigés.');
        } else this.error.set(this.errorText(err));
      },
    });
  }
  protected fieldError(name: string): string { return this.fieldErrors()[name]?.[0] ?? ''; }
  protected typeLabel(type: string): string { return ({ RETARD: 'Retard', PANNE: 'Panne', ABSENCE: 'Absence', IMPOSSIBILITE: 'Impossibilité', INDISPONIBILITE: 'Indisponibilité' } as Record<string, string>)[type] ?? type; }
  protected date(value?: string | null): string { return value ? new Date(value).toLocaleString('fr-FR') : '—'; }
  protected detailsFields(item: Signalement): [string, unknown][] { return Object.entries(item).filter(([key]) => key !== 'details'); }
  protected fieldLabel(key: string): string { return key.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()); }

  private emptyForm() { return { type: 'PANNE' as SignalementType, type_ressource: 'VEHICULE' as TypeRessource, ressource_id: null as number | null, course_id: null as number | null, details: '' }; }
  private errorText(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Une erreur inattendue est survenue.';
    const message = (error.error as { message?: string } | null)?.message;
    switch (error.status) {
      case 0: return 'Le serveur API est injoignable.';
      case 401: return 'Votre session a expiré. Reconnectez-vous.';
      case 403: return message || 'Vous n’êtes pas autorisé à effectuer cette action.';
      case 404: return message || 'Le signalement demandé est introuvable.';
      case 409: return message || 'Cette action entre en conflit avec une opération récente. Réessayez.';
      case 422: return message || 'Certains champs doivent être corrigés.';
      default: return message || 'Impossible de communiquer avec l’API des signalements.';
    }
  }
}
