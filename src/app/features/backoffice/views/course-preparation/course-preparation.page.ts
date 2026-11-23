import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { ApiService } from '@/core/services/api.service';

interface ApiItem<T> { message: string; data: T; }
interface ApiPage<T> { message: string; data: T[]; meta?: { current_page: number; last_page: number; total: number; per_page: number }; }
interface Demande {
  id: number; reference: string; statut: string;
  date_depart: string | null; heure_depart: string | null; heure_retour: string | null;
  adresse_depart?: { adresse?: string | null } | null;
  adresse_retour?: { adresse?: string | null } | null;
  destinations?: Array<{ ordre?: number; entite_geographique?: { adresse?: string | null } | null }>;
  employes?: unknown[];
  direction?: { nom: string } | null; service?: { nom: string } | null;
  personnes_count?: number; objets_count?: number;
}
interface Chauffeur { id: number; user_id: number | null; utilisateur?: { nom?: string; prenom?: string } | null; statut: string; }
interface Vehicule { id: number; immatriculation: string; marque?: string | null; modele?: string | null; statut: string; }
interface Course {
  id: number; lock_version: number; demande_ids: number[]; statut_execution: string | null;
  chauffeur_id?: number | null; vehicule_id?: number | null;
  plan?: { occupation_debut_prevue?: string | null; occupation_fin_prevue?: string | null; chargement_confirme?: boolean; arrets?: Array<{ ordre: number; demande_id: number; lieu: string; heure_prevue: string }> } | null;
}

@Component({
  selector: 'app-course-preparation-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './course-preparation.page.html',
  styleUrl: './course-preparation.page.scss',
})
export class CoursePreparationPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly demandeIds = [...new Set(
    (this.route.snapshot.queryParamMap.get('demandeIds') ?? this.route.snapshot.queryParamMap.get('demandeId') ?? '')
      .split(',').map((value) => Number(value.trim())).filter((id) => Number.isInteger(id) && id > 0),
  )];
  private readonly courseId = Number(this.route.snapshot.queryParamMap.get('courseId')) || null;
  private lockVersion = 0;

  protected readonly demandes = signal<Demande[]>([]);
  protected readonly chauffeurs = signal<Chauffeur[]>([]);
  protected readonly vehicules = signal<Vehicule[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly editing = signal(false);
  protected readonly form = new FormGroup({
    chauffeur_id: new FormControl<number | null>(null, Validators.required),
    vehicule_id: new FormControl<number | null>(null, Validators.required),
    debut: new FormControl('', Validators.required),
    fin: new FormControl('', Validators.required),
    chargement_confirme: new FormControl(false, Validators.requiredTrue),
    arrets: new FormArray<FormGroup> ([]),
  });

  ngOnInit(): void {
    if (this.courseId) {
      this.chargerBrouillon(this.courseId);
      return;
    }
    if (this.demandeIds.length === 0) {
      this.error.set('Sélectionnez au moins une demande à préparer.');
      this.loading.set(false);
      return;
    }
    this.chargerDemandesEtRessources(this.demandeIds);
  }

  protected get arrets(): FormArray<FormGroup> { return this.form.controls.arrets; }

  protected vehiculeLabel(vehicule: Vehicule): string {
    return [vehicule.immatriculation, vehicule.marque, vehicule.modele].filter(Boolean).join(' · ');
  }

  protected ajouterArret(): void {
    if (this.demandes().length === 0) return;
    const previous = this.arrets.at(this.arrets.length - 1)?.get('heure_prevue')?.value ?? this.form.controls.debut.value;
    this.arrets.push(this.stopGroup('', this.toLocalDateTime(previous || '')));
  }

  protected retirerArret(index: number): void {
    if (this.arrets.length > 1) this.arrets.removeAt(index);
  }

  protected enregistrer(): void {
    const demandes = this.demandes();
    if (demandes.length === 0 || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (new Date(value.fin!).getTime() <= new Date(value.debut!).getTime()) {
      this.error.set('La fin prévue doit être postérieure au début prévu.');
      return;
    }
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    const payload = {
      demande_ids: demandes.map((demande) => demande.id),
      chauffeur_id: value.chauffeur_id,
      vehicule_id: value.vehicule_id,
      plan: {
        occupation_debut_prevue: this.toApiDateTime(value.debut!),
        occupation_fin_prevue: this.toApiDateTime(value.fin!),
        chargement_confirme: value.chargement_confirme,
        arrets: (value.arrets ?? []).map((stop, index) => ({
          ordre: index + 1,
          demande_id: stop['demande_id'],
          lieu: stop['lieu'],
          heure_prevue: this.toApiDateTime(stop['heure_prevue']),
        })),
      },
    };
    const request: Observable<ApiItem<Course>> = this.courseId
      ? this.api.put<ApiItem<Course>>(`/courses/${this.courseId}`, { ...payload, version_attendue: this.lockVersion }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } })
      : this.api.post<ApiItem<Course>>('/courses', {}, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } }).pipe(
          switchMap(({ data: course }) => this.api.put<ApiItem<Course>>(`/courses/${course.id}`, {
            ...payload,
            version_attendue: course.lock_version,
          }, { headers: { 'Idempotency-Key': this.newIdempotencyKey() } })),
        );
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        void this.router.navigate(['/dashboard/gestion/courses/brouillons']);
      },
      error: (error: unknown) => {
        this.error.set(this.errorText(error, 'Impossible d’enregistrer le brouillon de course.'));
        this.saving.set(false);
      },
    });
  }

  protected retourTraitement(): void {
    void this.router.navigate([this.courseId ? '/dashboard/gestion/courses/brouillons' : '/dashboard/gestion/demandes']);
  }
  protected brouillons(): void { void this.router.navigate(['/dashboard/gestion/courses/brouillons']); }

  private chargerBrouillon(id: number): void {
    this.api.get<ApiItem<Course>>(`/courses/${id}`).subscribe({
      next: ({ data: course }) => {
        if (course.statut_execution !== null) {
          this.error.set('Seuls les brouillons peuvent être modifiés.');
          this.loading.set(false);
          return;
        }
        this.editing.set(true);
        this.lockVersion = course.lock_version;
        const ids = [...new Set(course.demande_ids ?? [])];
        if (!ids.length) {
          this.error.set('Ce brouillon ne contient aucune demande associée.');
          this.loading.set(false);
          return;
        }
        this.chargerDemandesEtRessources(ids, course);
      },
      error: (error: unknown) => { this.error.set(this.errorText(error, 'Impossible de charger le brouillon à modifier.')); this.loading.set(false); },
    });
  }

  private chargerDemandesEtRessources(ids: number[], course?: Course): void {
    forkJoin({
      demandes: this.chargerDemandes(ids),
      chauffeurs: this.api.get<ApiPage<Chauffeur>>('/parametrage/chauffeurs', { params: { page: '1', per_page: '100', statut: 'ACTIF' } }),
      vehicules: this.api.get<ApiPage<Vehicule>>('/parametrage/vehicules', { params: { page: '1', per_page: '100', statut: 'ACTIF' } }),
    }).subscribe({
      next: ({ demandes, chauffeurs, vehicules }) => {
        this.demandes.set(demandes);
        this.chauffeurs.set(chauffeurs.data ?? []);
        this.vehicules.set(vehicules.data ?? []);
        if (course) this.setCourseValues(course);
        else this.setDefaults(demandes);
        this.loading.set(false);
      },
      error: (error: unknown) => { this.error.set(this.errorText(error, 'Impossible de charger les demandes ou les ressources disponibles.')); this.loading.set(false); },
    });
  }

  private chargerDemandes(ids: number[]): Observable<Demande[]> {
    const wanted = new Set(ids);
    const found = new Map<number, Demande>();
    const loadPage = (pageNumber: number): Observable<Demande[]> => this.api.get<ApiPage<Demande>>('/traitement/demandes', {
      params: { page: String(pageNumber), per_page: '100' },
    }).pipe(switchMap((response) => {
      for (const demande of response.data ?? []) {
        if (wanted.has(demande.id)) found.set(demande.id, demande);
      }
      const lastPage = response.meta?.last_page ?? pageNumber;
      if (found.size === wanted.size || pageNumber >= lastPage) {
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length) return throwError(() => new Error(`La ou les demandes ${missing.map((id) => `#${id}`).join(', ')} ne sont plus en attente de traitement.`));
        return forkJoin(ids.map((id) => this.api.get<ApiItem<Demande>>(`/traitement/demandes/${id}`))).pipe(
          map((details) => ids.map((id, index) => {
            const summary = found.get(id)!;
            const demande = details[index].data;
            return {
              ...summary,
              ...demande,
              personnes_count: demande.personnes_count ?? demande.employes?.length ?? summary.personnes_count,
            };
          })),
        );
      }
      return loadPage(pageNumber + 1);
    }));
    return loadPage(1);
  }

  private setCourseValues(course: Course): void {
    const plan = course.plan;
    this.form.patchValue({
      chauffeur_id: course.chauffeur_id ?? null,
      vehicule_id: course.vehicule_id ?? null,
      debut: this.toLocalDateTime(plan?.occupation_debut_prevue ?? ''),
      fin: this.toLocalDateTime(plan?.occupation_fin_prevue ?? ''),
      chargement_confirme: plan?.chargement_confirme ?? false,
    });
    const defaultStops = this.buildDefaultStops(this.demandes());
    const existingStops = plan?.arrets ?? [];
    for (let index = 0; index < Math.max(existingStops.length, defaultStops.length); index++) {
      const existing = existingStops[index];
      const fallback = defaultStops[index];
      this.arrets.push(this.stopGroup(
        existing?.lieu?.trim() || fallback?.lieu || '',
        this.toLocalDateTime(existing?.heure_prevue || fallback?.heure || ''),
        existing?.demande_id ?? fallback?.demandeId ?? this.demandes()[0]?.id ?? 0,
      ));
    }
    if (!this.arrets.length) this.setDefaults(this.demandes());
  }

  private setDefaults(demandes: Demande[]): void {
    const schedules = demandes.map((demande) => {
      const start = this.toLocalDateTime(`${demande.date_depart ?? ''}T${(demande.heure_depart ?? '08:00').slice(0, 5)}`)
        || this.toLocalDateTime(new Date().toISOString());
      let end = this.toLocalDateTime(`${demande.date_depart ?? ''}T13:00`);
      if (!end || new Date(end) <= new Date(start)) {
        const defaultEnd = new Date(start);
        defaultEnd.setHours(defaultEnd.getHours() + 1);
        end = this.toLocalDateTime(defaultEnd.toISOString());
      }
      return { demande, start, end };
    });
    const start = schedules.map((schedule) => schedule.start).sort()[0];
    const end = schedules.map((schedule) => schedule.end).sort().at(-1) ?? start;
    this.form.patchValue({ debut: start, fin: end });
    const stops = this.buildDefaultStops(demandes, schedules);
    for (const stop of stops) this.arrets.push(this.stopGroup(stop.lieu, stop.heure, stop.demandeId));
  }

  private buildDefaultStops(
    demandes: Demande[],
    schedules = demandes.map((demande) => ({
      demande,
      start: this.toLocalDateTime(`${demande.date_depart ?? ''}T${(demande.heure_depart ?? '08:00').slice(0, 5)}`),
    })),
  ): Array<{ lieu: string; heure: string; demandeId: number }> {
    const stops: Array<{ lieu: string; heure: string; demandeId: number }> = [];
    for (const { demande, start } of schedules) {
      const lieux = [
        demande.adresse_depart?.adresse,
        ...(demande.destinations ?? [])
          .slice()
          .sort((left, right) => (left.ordre ?? 0) - (right.ordre ?? 0))
          .map((destination) => destination.entite_geographique?.adresse),
        demande.adresse_retour?.adresse,
      ].map((lieu) => lieu?.trim() ?? '').filter(Boolean);
      const distinctLieux = lieux.filter((lieu, index) => index === 0 || lieu.toLocaleLowerCase() !== lieux[index - 1].toLocaleLowerCase());
      for (const lieu of distinctLieux.length ? distinctLieux : ['']) {
        stops.push({ lieu, heure: start, demandeId: demande.id });
      }
    }
    return stops;
  }

  private stopGroup(lieu: string, heure: string, demandeId = this.demandes()[0]?.id ?? 0): FormGroup {
    return new FormGroup({
      demande_id: new FormControl(demandeId, { nonNullable: true, validators: Validators.required }),
      lieu: new FormControl(lieu, { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
      heure_prevue: new FormControl(heure, { nonNullable: true, validators: Validators.required }),
    });
  }

  private toLocalDateTime(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private toApiDateTime(value: string): string {
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

  private errorText(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return error instanceof Error ? error.message : fallback;
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (error.status === 403) return 'Accès refusé : votre rôle ne permet pas de consulter ou créer une course.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    const body = error.error as { message?: string } | null;
    return body?.message || fallback;
  }
}
