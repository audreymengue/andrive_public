import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '@/core/services/api.service';

interface ApiItem<T> { data: T; }
interface Personne { nom?: string; prenom?: string; fonction?: string | null; }
interface Demande {
  id: number; reference?: string; statut?: string; motif?: string; commentaire?: string | null;
  date_depart?: string | null; heure_depart?: string | null; heure_retour?: string | null;
  demandeur?: Personne | null; direction?: { nom?: string } | null; service?: { nom?: string } | null;
  type_sortie?: { libelle?: string } | null; adresse_depart?: { adresse?: string } | null;
  adresse_retour?: { adresse?: string } | null;
  destinations?: Array<{ ordre?: number; entite_geographique?: { adresse?: string } | null }>;
  employes?: Personne[]; objets?: Array<{ designation?: string; quantite?: number | null; description?: string | null }>;
}
interface Arret { ordre?: number; lieu?: string; heure_prevue?: string; demande_id?: number; }
interface Course {
  id: number; statut_execution?: string; lock_version?: number; version_preparation?: number;
  demande_ids?: number[]; chauffeur_id?: number | null; vehicule_id?: number | null;
  plan?: { occupation_debut_prevue?: string | null; occupation_fin_prevue?: string | null; chargement_confirme?: boolean; arrets?: Arret[] } | null;
  created_at?: string | null;
}
interface Ressources { chauffeurs: Array<{ id: number; nom: string; prenom: string }>; vehicules: Array<{ id: number; immatriculation: string; marque: string; modele: string }>; }

@Component({ selector: 'app-course-detail-page', standalone: true, imports: [CommonModule], templateUrl: './course-detail.page.html', styleUrl: './course-detail.page.scss' })
export class CourseDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly validationInfo = signal('');
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
          ressources: this.api.get<ApiItem<Ressources>>('/traitement/courses/ressources').pipe(catchError(() => of({ data: { chauffeurs: [], vehicules: [] } }))),
          demandes: ids.length ? forkJoin(ids.map((demandeId) => this.api.get<ApiItem<Demande>>(`/traitement/demandes/${demandeId}`))) : of([]),
        }).subscribe({
          next: ({ ressources, demandes }) => { this.ressources.set(ressources.data); this.demandes.set(demandes.map((item) => item.data)); this.loading.set(false); },
          error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
        });
      },
      error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
    });
  }
  protected chauffeur(): string {
    const id = this.course()?.chauffeur_id;
    const person = this.ressources().chauffeurs.find((item) => item.id === id);
    return person ? `${person.prenom} ${person.nom}` : id ? `Chauffeur #${id}` : 'Non affecté';
  }
  protected vehicule(): string {
    const id = this.course()?.vehicule_id;
    const item = this.ressources().vehicules.find((vehicle) => vehicle.id === id);
    return item ? `${item.immatriculation} · ${item.marque} ${item.modele}` : id ? `Véhicule #${id}` : 'Non affecté';
  }
  protected statut(): string { return (this.course()?.statut_execution || 'brouillon_preparation').replaceAll('_', ' '); }
  protected retour(): void { void this.router.navigate(['/dashboard/gestion/demandes']); }
  protected brouillons(): void { void this.router.navigate(['/dashboard/gestion/courses/brouillons']); }
  protected modifier(): void {
    const id = this.course()?.id;
    if (id) void this.router.navigate(['/dashboard/gestion/courses/nouvelle'], { queryParams: { courseId: id } });
  }
  protected valider(): void {
    this.validationInfo.set('La validation définitive sera activée lorsque la route correspondante sera disponible dans le backend. Ce brouillon reste inchangé.');
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
