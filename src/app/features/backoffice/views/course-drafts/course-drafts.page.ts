import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/core/services/api.service';

interface Course {
  id: number;
  statut_execution: string | null;
  lock_version: number;
  version_preparation?: number;
  demande_ids?: number[];
  created_at?: string | null;
  updated_at?: string | null;
}
interface CourseListResponse { message: string; data: Course[]; meta?: { current_page: number; last_page: number; total: number }; }

@Component({
  selector: 'app-course-drafts-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-drafts.page.html',
  styleUrl: './course-drafts.page.scss',
})
export class CourseDraftsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly drafts = signal<Course[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);

  ngOnInit(): void { this.charger(); }

  protected charger(page = 1): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<CourseListResponse>(`/courses?page=${page}&per_page=100`).subscribe({
      next: (response) => {
        const items = response.data ?? [];
        this.drafts.set(items.filter((course) => course.statut_execution === null));
        this.total.set(response.meta?.total ?? items.length);
        this.page.set(response.meta?.current_page ?? page);
        this.lastPage.set(response.meta?.last_page ?? 1);
        this.loading.set(false);
      },
      error: (error: unknown) => { this.error.set(this.errorText(error)); this.loading.set(false); },
    });
  }

  protected pagePrecedente(): void { if (this.page() > 1) this.charger(this.page() - 1); }
  protected pageSuivante(): void { if (this.page() < this.lastPage()) this.charger(this.page() + 1); }

  protected ouvrir(course: Course): void { void this.router.navigate(['/dashboard/gestion/courses', course.id]); }
  protected modifier(course: Course): void {
    void this.router.navigate(['/dashboard/gestion/courses/nouvelle'], { queryParams: { courseId: course.id } });
  }
  protected nouvellePreparation(): void { void this.router.navigate(['/dashboard/gestion/demandes']); }

  private errorText(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Impossible de charger les brouillons de courses.';
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (error.status === 403) return 'Votre rôle ne permet pas de consulter les préparations de courses.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    return (error.error as { message?: string } | null)?.message || 'Impossible de charger les brouillons de courses.';
  }
}
