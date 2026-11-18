import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@/core/services/api.service';

interface Course {
  id: number;
  statut_execution: string | null;
  lock_version: number;
  chauffeur_id?: number | null;
  vehicule_id?: number | null;
  plan?: {
    occupation_debut_prevue?: string | null;
    occupation_fin_prevue?: string | null;
    arrets?: Array<{ ordre?: number; lieu?: string; heure_prevue?: string | null }>;
  } | null;
  demarree_a?: string | null;
  terminee_a?: string | null;
}
interface CourseListResponse { data: Course[]; meta?: { current_page: number; last_page: number; total: number }; }

@Component({
  selector: 'app-missions-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './missions.page.html',
  styleUrl: './missions.page.scss',
})
export class MissionsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly history = this.route.snapshot.data['missionStatus'] === 'history';
  protected readonly title = this.history ? 'Historique des missions' : 'Missions planifiées';
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly courses = signal<Course[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);

  ngOnInit(): void { this.charger(); }

  protected charger(page = 1): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<CourseListResponse>(`/courses?page=${page}&per_page=100`).subscribe({
      next: (response) => {
        const courses = response.data ?? [];
        this.courses.set(courses.filter((course) => this.history
          ? course.statut_execution === 'TERMINEE'
          : course.statut_execution === 'A_VENIR' || course.statut_execution === 'EN_COURS'));
        this.total.set(response.meta?.total ?? courses.length);
        this.page.set(response.meta?.current_page ?? page);
        this.lastPage.set(response.meta?.last_page ?? 1);
        this.loading.set(false);
      },
      error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
    });
  }

  protected ouvrir(course: Course): void { void this.router.navigate(['/dashboard/missions', course.id]); }
  protected precedente(): void { if (this.page() > 1) this.charger(this.page() - 1); }
  protected suivante(): void { if (this.page() < this.lastPage()) this.charger(this.page() + 1); }
  protected statutLabel(status: string | null): string {
    switch (status) {
      case 'A_VENIR': return 'À venir';
      case 'EN_COURS': return 'En cours';
      case 'TERMINEE': return 'Terminée';
      default: return 'Indéterminé';
    }
  }

  private errorText(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de charger les courses.';
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (error.status === 403) return 'Votre rôle ne permet pas de consulter les courses affectées.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    return (error.error as { message?: string } | null)?.message || 'Impossible de charger les courses.';
  }
}
