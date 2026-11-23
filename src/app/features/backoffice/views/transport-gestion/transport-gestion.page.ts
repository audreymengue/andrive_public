import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TransportService, ChauffeurTransport, VehiculeTransport, IndisponibiliteTransport, RessourceTransport } from '../../services/transport.service';

@Component({ selector: 'app-transport-gestion-page', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './transport-gestion.page.html', styleUrl: './transport-gestion.page.scss' })
export class TransportGestionPage implements OnInit {
  private readonly api = inject(TransportService);
  protected readonly chauffeurs = signal<ChauffeurTransport[]>([]);
  protected readonly vehicules = signal<VehiculeTransport[]>([]);
  protected readonly periods = signal<IndisponibiliteTransport[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly showClosed = signal(false);
  protected readonly target = signal<IndisponibiliteTransport | null>(null);
  protected readonly returnReason = signal('');
  protected readonly returnError = signal('');
  protected form: { type: RessourceTransport; resourceId: number | null; start: string; estimatedEnd: string; reason: string } = { type: 'CHAUFFEUR', resourceId: null, start: '', estimatedEnd: '', reason: '' };

  ngOnInit(): void { this.charger(); }

  protected charger(): void {
    this.loading.set(true); this.error.set('');
    let pending = 3;
    const finish = (): void => { pending -= 1; if (pending === 0) this.loading.set(false); };
    this.api.chauffeursActifs().subscribe({ next: (r) => this.chauffeurs.set(r.data ?? []), error: (e: unknown) => { this.error.set(this.message(e)); finish(); }, complete: finish });
    this.api.vehiculesActifs().subscribe({ next: (r) => this.vehicules.set(r.data ?? []), error: (e: unknown) => { this.error.set(this.message(e)); finish(); }, complete: finish });
    this.chargerPeriods(finish);
  }

  protected chargerPeriods(onComplete?: () => void): void {
    this.api.indisponibilites(!this.showClosed()).subscribe({
      next: (r) => this.periods.set(r.data ?? []),
      error: (e: unknown) => { this.error.set(this.message(e)); onComplete?.(); },
      complete: () => onComplete?.(),
    });
  }

  protected changerPeriode(closed: boolean): void { this.showClosed.set(closed); this.chargerPeriods(); }
  protected resourceOptions(): Array<{ id: number; label: string; version: number }> {
    return this.form.type === 'CHAUFFEUR'
      ? this.chauffeurs().map((x) => ({ id: x.id, version: x.lock_version, label: `${x.utilisateur?.prenom ?? ''} ${x.utilisateur?.nom ?? ''}`.trim() || `Chauffeur #${x.id}` }))
      : this.vehicules().map((x) => ({ id: x.id, version: x.lock_version, label: [x.immatriculation, x.marque, x.modele].filter(Boolean).join(' · ') }));
  }

  protected resourceLabel(item: IndisponibiliteTransport): string {
    if (item.type_ressource === 'CHAUFFEUR') {
      const driver = this.chauffeurs().find((x) => x.id === item.ressource_id);
      const name = `${driver?.utilisateur?.prenom ?? ''} ${driver?.utilisateur?.nom ?? ''}`.trim();
      return name || `Chauffeur #${item.ressource_id}`;
    }
    const vehicle = this.vehicules().find((x) => x.id === item.ressource_id);
    return vehicle
      ? [vehicle.immatriculation, vehicle.marque, vehicle.modele].filter(Boolean).join(' · ')
      : `Véhicule #${item.ressource_id}`;
  }

  protected creer(): void {
    const resource = this.resourceOptions().find((item) => item.id === Number(this.form.resourceId));
    if (!resource || !this.form.start || !this.form.reason.trim()) { this.error.set('Choisissez une ressource, un début et un motif.'); return; }
    if (this.form.estimatedEnd && new Date(this.form.estimatedEnd) <= new Date(this.form.start)) { this.error.set('La fin estimée doit être après le début.'); return; }
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.api.creerIndisponibilite({ type_ressource: this.form.type, ressource_id: resource.id, version_ressource_attendue: resource.version, debut_a: new Date(this.form.start).toISOString(), fin_estimee_a: this.form.estimatedEnd ? new Date(this.form.estimatedEnd).toISOString() : null, motif: this.form.reason.trim() }).subscribe({
      next: ({ message }) => { this.saving.set(false); this.success.set(message || 'Indisponibilité enregistrée.'); this.form = { ...this.form, resourceId: null, start: '', estimatedEnd: '', reason: '' }; this.charger(); },
      error: (e: unknown) => { this.saving.set(false); this.error.set(this.message(e)); },
    });
  }

  protected demanderRetour(item: IndisponibiliteTransport): void { this.target.set(item); this.returnReason.set(''); this.returnError.set(''); }
  protected fermerRetour(): void { if (!this.saving()) { this.target.set(null); this.returnError.set(''); } }
  protected confirmerRetour(): void {
    const item = this.target(); const motif = this.returnReason().trim();
    if (!item || !motif || this.saving()) { this.returnError.set('Indiquez le motif de la remise en service.'); return; }
    this.saving.set(true); this.returnError.set('');
    this.api.remettreEnService(item.id, { version_attendue: item.lock_version, fin_effective_a: new Date().toISOString(), motif }).subscribe({
      next: ({ message }) => { this.saving.set(false); this.target.set(null); this.success.set(message || 'Remise en service enregistrée.'); this.charger(); },
      error: (e: unknown) => { this.saving.set(false); this.returnError.set(this.message(e)); },
    });
  }

  protected identifierType(value: string): string { return value === 'VEHICULE' ? 'Véhicule' : 'Chauffeur'; }
  private message(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de communiquer avec l’API Transport.';
    if (error.status === 403) return 'Votre compte ne dispose pas des permissions Transport nécessaires.';
    if (error.status === 409) return error.error?.message || 'La ressource a changé. Actualisez la liste puis réessayez.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    return error.error?.message || 'L’opération Transport a échoué.';
  }
}
