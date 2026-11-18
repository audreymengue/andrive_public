import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@/core/services/api.service';

interface ApiItem<T> { data: T; }
interface Course {
  id: number;
  statut_execution: string | null;
  lock_version: number;
  chauffeur_id?: number | null;
  vehicule_id?: number | null;
  version_preparation?: number;
  demande_ids?: number[];
  plan?: {
    occupation_debut_prevue?: string | null;
    occupation_fin_prevue?: string | null;
    chargement_confirme?: boolean;
    arrets?: Array<{ ordre?: number; lieu?: string; heure_prevue?: string | null }>;
  } | null;
  demarree_a?: string | null;
  terminee_a?: string | null;
  chauffeur_libere_a?: string | null;
  vehicule_libere_a?: string | null;
}

@Component({
  selector: 'app-mission-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mission-detail.page.html',
  styleUrl: './mission-detail.page.scss',
})
export class MissionDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly course = signal<Course | null>(null);
  protected readonly finishForm = new FormGroup({
    fin_reelle: new FormControl(this.localNow(), { nonNullable: true, validators: Validators.required }),
    chauffeur_libere_a: new FormControl(this.localNow(), { nonNullable: true, validators: Validators.required }),
    vehicule_libere_a: new FormControl(this.localNow(), { nonNullable: true, validators: Validators.required }),
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id < 1) {
      this.error.set('La course demandée est introuvable.');
      this.loading.set(false);
      return;
    }
    this.charger(id);
  }

  protected charger(id = this.course()?.id): void {
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.api.get<ApiItem<Course>>(`/courses/${id}`).subscribe({
      next: ({ data }) => {
        this.course.set(data);
        if (data.statut_execution === 'EN_COURS' && data.demarree_a) {
          const now = Math.floor(Date.now() / 1000) * 1000;
          const startedAt = new Date(data.demarree_a).getTime();
          const initialTime = this.localDateTime(Math.max(now, Math.ceil(startedAt / 1000) * 1000));
          this.finishForm.setValue({
            fin_reelle: initialTime,
            chauffeur_libere_a: initialTime,
            vehicule_libere_a: initialTime,
          });
        }
        this.loading.set(false);
      },
      error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
    });
  }

  protected demarrer(): void {
    const course = this.course();
    if (!course || course.statut_execution !== 'A_VENIR' || this.saving()) return;
    this.commande('depart', { version_attendue: course.lock_version }, 'Course démarrée. Vous pouvez maintenant enregistrer sa fin réelle.');
  }

  protected terminer(): void {
    const course = this.course();
    if (!course || course.statut_execution !== 'EN_COURS' || this.saving()) return;
    if (this.finishForm.invalid) { this.finishForm.markAllAsTouched(); return; }
    const value = this.finishForm.getRawValue();
    const finishedAt = new Date(value.fin_reelle).getTime();
    const driverReleasedAt = new Date(value.chauffeur_libere_a).getTime();
    const vehicleReleasedAt = new Date(value.vehicule_libere_a).getTime();
    const startedAt = course.demarree_a ? new Date(course.demarree_a).getTime() : 0;
    if (finishedAt < startedAt || driverReleasedAt < finishedAt || vehicleReleasedAt < finishedAt) {
      this.error.set('Les heures doivent respecter cet ordre : départ, fin, puis libération du chauffeur et du véhicule.');
      return;
    }
    this.commande('terminer', {
      version_attendue: course.lock_version,
      fin_reelle: this.apiDateTime(value.fin_reelle),
      chauffeur_libere_a: this.apiDateTime(value.chauffeur_libere_a),
      vehicule_libere_a: this.apiDateTime(value.vehicule_libere_a),
    }, 'Course terminée. Les heures de libération du chauffeur et du véhicule sont enregistrées.');
  }

  protected statutLabel(): string {
    switch (this.course()?.statut_execution) {
      case 'A_VENIR': return 'À venir';
      case 'EN_COURS': return 'En cours';
      case 'TERMINEE': return 'Terminée';
      default: return 'Non confirmée';
    }
  }

  protected retour(): void {
    void this.router.navigate([this.course()?.statut_execution === 'TERMINEE' ? '/dashboard/missions/historique' : '/dashboard/missions/planifiees']);
  }

  private commande(action: 'depart' | 'terminer', body: Record<string, unknown>, successMessage: string): void {
    const course = this.course();
    if (!course) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.api.post<ApiItem<Course>>(`/courses/${course.id}/${action}`, body, {
      headers: { 'Idempotency-Key': this.newIdempotencyKey() },
    }).subscribe({
      next: ({ data }) => { this.course.set(data); this.success.set(successMessage); this.saving.set(false); },
      error: (error: unknown) => { this.error.set(this.errorText(error)); this.saving.set(false); },
    });
  }

  private localDateTime(timestamp = Date.now()): string {
    const date = new Date(timestamp);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 19);
  }

  private localNow(): string {
    return this.localDateTime();
  }

  private apiDateTime(value: string): string {
    return new Date(value).toISOString().replace(/\.\d{3}Z$/, '+00:00');
  }

  private newIdempotencyKey(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.floor(Math.random() * 16);
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
  }

  private errorText(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de charger ou modifier cette course.';
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (error.status === 403) return 'Action refusée : votre compte ne dispose pas de la permission nécessaire.';
    if (error.status === 404) return 'Cette course ne vous est pas affectée ou elle est introuvable.';
    if (error.status === 409) return (error.error as { message?: string } | null)?.message || 'La course a changé ou une ressource n’est plus disponible. Actualisez la fiche.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    return (error.error as { message?: string } | null)?.message || 'Impossible de charger ou modifier cette course.';
  }
}
