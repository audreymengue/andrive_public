import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { TransportService, TransportItem, CancellationAlert } from '../../services/transport.service';

@Component({ selector: 'app-alertes-page', standalone: true, imports: [CommonModule], templateUrl: './alertes.page.html', styleUrl: './alertes.page.scss' })
export class AlertesPage implements OnInit {
  private readonly transport = inject(TransportService);
  protected readonly signalements = signal<TransportItem[]>([]);
  protected readonly annulations = signal<CancellationAlert[]>([]);
  protected readonly chargementSignalements = signal(true);
  protected readonly chargementAnnulations = signal(true);
  protected readonly erreurSignalements = signal('');
  protected readonly erreurAnnulations = signal('');

  ngOnInit(): void { this.actualiser(); }
  protected actualiser(): void {
    this.chargementSignalements.set(true); this.chargementAnnulations.set(true);
    this.erreurSignalements.set(''); this.erreurAnnulations.set('');
    this.transport.signalements().subscribe({ next: (r) => { this.signalements.set(r.data ?? []); this.chargementSignalements.set(false); }, error: (e: unknown) => { this.erreurSignalements.set(this.messageErreur(e)); this.chargementSignalements.set(false); } });
    this.transport.annulations().subscribe({ next: (r) => { this.annulations.set(r.data ?? []); this.chargementAnnulations.set(false); }, error: (e: unknown) => { this.erreurAnnulations.set(this.messageErreur(e)); this.chargementAnnulations.set(false); } });
  }
  protected sourceRessource(type: string): string { return type === 'VEHICULE' ? 'Véhicule' : 'Chauffeur'; }
  private messageErreur(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de récupérer cette liste.';
    if (error.status === 403) return 'Votre compte ne dispose pas de la permission de consulter ces alertes.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    return error.error?.message || 'Impossible de récupérer cette liste.';
  }
}
