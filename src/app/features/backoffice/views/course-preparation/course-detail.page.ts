import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '@/core/services/api.service';

interface ApiItem<T> { data: T; }
interface ApiPage<T> { data: T[]; }
interface Demande { id: number; }
interface Arret { ordre?: number; lieu?: string; heure_prevue?: string; demande_id?: number; }
interface Course {
  id: number; statut_execution?: string; lock_version?: number; version_preparation?: number;
  demande_ids?: number[]; chauffeur_id?: number | null; vehicule_id?: number | null;
  plan?: { occupation_debut_prevue?: string | null; occupation_fin_prevue?: string | null; chargement_confirme?: boolean; arrets?: Arret[] } | null;
  demarree_a?: string | null; terminee_a?: string | null; chauffeur_libere_a?: string | null; vehicule_libere_a?: string | null;
  created_at?: string | null;
}
interface Chauffeur { id: number; utilisateur?: { nom?: string; prenom?: string } | null; }
interface Vehicule { id: number; immatriculation: string; }
interface Ressources { chauffeurs: Chauffeur[]; vehicules: Vehicule[]; }

@Component({ selector: 'app-course-detail-page', standalone: true, imports: [CommonModule], templateUrl: './course-detail.page.html', styleUrl: './course-detail.page.scss' })
export class CourseDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly validationInfo = signal('');
  protected readonly confirming = signal(false);
  protected readonly course = signal<Course | null>(null);
  protected readonly demandes = signal<Demande[]>([]);
  protected readonly ressources = signal<Ressources>({ chauffeurs: [], vehicules: [] });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id < 1) { this.error.set('La course demandée est introuvable.'); this.loading.set(false); return; }
    this.api.get<ApiItem<Course>>(`/courses/${id}`).subscribe({
      next: ({ data: course }) => {
        this.course.set(course);
        const ids = course.demande_ids ?? [];
        forkJoin({
          chauffeurs: this.api.get<ApiPage<Chauffeur>>('/parametrage/chauffeurs', { params: { page: '1', per_page: '100' } }).pipe(catchError(() => of({ data: [] }))),
          vehicules: this.api.get<ApiPage<Vehicule>>('/parametrage/vehicules', { params: { page: '1', per_page: '100' } }).pipe(catchError(() => of({ data: [] }))),
          demandes: of(ids.map((demandeId) => ({ id: demandeId }))),
        }).subscribe({
          next: ({ chauffeurs, vehicules, demandes }) => { this.ressources.set({ chauffeurs: chauffeurs.data, vehicules: vehicules.data }); this.demandes.set(demandes); this.loading.set(false); },
          error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
        });
      },
      error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
    });
  }
  protected chauffeur(): string {
    const id = this.course()?.chauffeur_id;
    const person = this.ressources().chauffeurs.find((item) => item.id === id);
    return person ? `${person.utilisateur?.prenom ?? ''} ${person.utilisateur?.nom ?? ''}`.trim() || `Chauffeur #${id}` : id ? `Chauffeur #${id}` : 'Non affecté';
  }
  protected vehicule(): string {
    const id = this.course()?.vehicule_id;
    const item = this.ressources().vehicules.find((vehicle) => vehicle.id === id);
    return item ? item.immatriculation : id ? `Véhicule #${id}` : 'Non affecté';
  }
  protected statut(): string { return (this.course()?.statut_execution || 'brouillon_preparation').replaceAll('_', ' '); }
  protected retour(): void { void this.router.navigate(['/dashboard/gestion/demandes']); }
  protected brouillons(): void { void this.router.navigate(['/dashboard/gestion/courses/brouillons']); }
  protected modifier(): void {
    const id = this.course()?.id;
    if (id) void this.router.navigate(['/dashboard/gestion/courses/nouvelle'], { queryParams: { courseId: id } });
  }
  protected confirmer(): void {
    const course = this.course();
    if (!course || course.statut_execution !== null || this.confirming()) return;
    this.confirming.set(true);
    this.error.set('');
    this.validationInfo.set('');
    this.api.post<ApiItem<Course>>(`/courses/${course.id}`, {
      version_attendue: course.lock_version,
      motif: 'Confirmation de la course',
    }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } }).subscribe({
      next: ({ data }) => {
        this.course.set(data);
        this.demandes.update((items) => items.map((demande) => ({ ...demande, statut: 'VALIDEE' })));
        this.confirming.set(false);
        this.validationInfo.set('Course confirmée. Les demandes associées sont validées et le chauffeur peut consulter sa mission.');
      },
      error: (error: unknown) => {
        this.error.set(this.errorText(error));
        this.confirming.set(false);
      },
    });
  }
  protected statutExecutionLabel(): string {
    switch (this.course()?.statut_execution) {
      case 'A_VENIR': return 'À venir';
      case 'EN_COURS': return 'En cours';
      case 'TERMINEE': return 'Terminée';
      default: return 'Brouillon';
    }
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
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de charger les détails de la course.';
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (error.status === 403) return 'Vous n’êtes pas autorisé à consulter cette course.';
    if (error.status === 404) return 'Cette course est introuvable.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    return (error.error as { message?: string } | null)?.message || 'Impossible de charger les détails de la course.';
  }
}
