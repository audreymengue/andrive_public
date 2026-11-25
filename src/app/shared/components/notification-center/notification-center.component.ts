import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { ApiService } from '@/core/services/api.service';
import { CoreService } from '@/core/services/core.service';

interface NotificationRow {
  id: string | number;
  title?: string;
  titre?: string;
  message?: string;
  contenu?: string;
  type?: string;
  evenement?: string;
  created_at?: string;
  date?: string;
  read_at?: string | null;
  lu?: boolean | number | string;
  lue?: boolean | number | string;
  read?: boolean;
  data?: Record<string, unknown> | null;
  url?: string;
  route?: string;
  demande_id?: string | number;
  mission_id?: string | number;
  course_id?: string | number;
  request_id?: string | number;
  reference_demande?: string | null;
  demande?: { id?: string | number; reference?: string } | null;
  mission?: { id?: string | number; reference?: string } | null;
  course?: { id?: string | number; reference?: string } | null;
}

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.scss',
})
export class NotificationCenterComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly core = inject(CoreService);
  protected readonly open = signal(false);
  protected readonly unreadOnly = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly rows = signal<NotificationRow[]>([]);
  protected readonly unreadCount = signal(0);
  protected readonly markingAll = signal(false);

  ngOnInit(): void {
    this.refresh();
    timer(30_000, 30_000).pipe(takeUntilDestroyed()).subscribe(() => this.refreshUnreadCount());
  }

  protected toggle(): void {
    this.open.update(value => !value);
    if (this.open()) this.refresh();
  }

  protected setFilter(unread: boolean): void {
    if (this.unreadOnly() === unread) return;
    this.unreadOnly.set(unread);
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new HttpParams().set('page', 1).set('per_page', 6).set('non_lues', this.unreadOnly());
    this.api.get<unknown>('/notifications', { params }).subscribe({
      next: response => {
        const root = this.record(response);
        const data = root['data'];
        const nested = this.record(data);
        const raw = Array.isArray(data) ? data : Array.isArray(nested['data']) ? nested['data'] : Array.isArray(nested['notifications']) ? nested['notifications'] : Array.isArray(root['notifications']) ? root['notifications'] : [];
        this.rows.set(raw.map(value => {
          const row = this.record(value);
          return { ...row, id: typeof row['id'] === 'string' || typeof row['id'] === 'number' ? row['id'] : '' } as NotificationRow;
        }));
        this.loading.set(false);
      },
      error: error => { this.error.set(this.errorMessage(error)); this.loading.set(false); },
    });
    this.refreshUnreadCount();
  }

  private refreshUnreadCount(): void {
    this.api.get<unknown>('/notifications/unread-count').subscribe({
      next: response => {
        const root = this.record(response);
        const data = this.record(root['data']);
        const count = root['count'] ?? root['unread_count'] ?? data['count'] ?? data['unread_count'] ?? (typeof root['data'] === 'number' ? root['data'] : 0);
        this.unreadCount.set(Math.max(0, Number(count) || 0));
      },
    });
  }

  protected isRead(item: NotificationRow): boolean {
    return item.read_at != null || item.lu === true || item.lu === 1 || item.lu === '1' || item.lue === true || item.lue === 1 || item.lue === '1' || item.read === true;
  }

  protected title(item: NotificationRow): string {
    const data = this.record(item.data);
    const related = this.record(data['demande'] ?? data['mission'] ?? data['course']);
    const value = item.titre || item.title || data['titre'] || data['title'] || data['objet'] || data['subject'];
    if (typeof value === 'string' && value.trim()) return value.trim();
    const evenement = item.evenement || item.type || String(data['evenement'] ?? data['event'] ?? '');
    const reference = item.reference_demande ?? related['reference'] ?? data['reference_demande'] ?? data['reference'];
    const titles: Record<string, string> = {
      COURSE_ASSIGNEE: 'Nouvelle mission affectée',
      DEMANDE_VALIDEE: 'Demande validée',
      DEMANDE_SOUMISE: 'Nouvelle demande à traiter',
      DEMANDE_RESOUMISE: 'Demande modifiée à revalider',
      COURSE_DEMARREE: 'Mission démarrée',
      COURSE_TERMINEE: 'Mission terminée',
    };
    const mapped = titles[evenement.toLocaleUpperCase()];
    if (mapped) return reference && evenement.toLocaleUpperCase().startsWith('DEMANDE') ? `${mapped} · ${reference}` : mapped;
    if (reference && /demande|request|sortie/i.test(evenement)) return `Demande ${String(reference)}`;
    if (reference && /mission|course|chauffeur/i.test(evenement)) return `Mission ${String(reference)}`;
    return evenement ? this.humanize(evenement) : 'Notification';
  }
  protected message(item: NotificationRow): string {
    const data = this.record(item.data);
    const related = this.record(data['demande'] ?? data['mission'] ?? data['course']);
    const message = item.message || item.contenu || data['message'] || data['description'] || data['contenu'] || data['body'] || data['text'];
    if (typeof message === 'string' && message.trim()) return message.trim();
    const reference = item.reference_demande ?? related['reference'] ?? data['reference_demande'] ?? data['reference'];
    const status = data['statut'] ?? data['status'];
    if (reference && status) return `Référence ${String(reference)} · Statut : ${this.humanize(String(status))}`;
    if (reference) return `Référence ${String(reference)}`;
    return 'Une nouvelle information est disponible.';
  }
  protected date(item: NotificationRow): string | null { return item.created_at || item.date || null; }

  protected markAllRead(): void {
    if (!this.unreadCount() || this.markingAll()) return;
    this.markingAll.set(true);
    this.api.patch<unknown>('/notifications/read-all', {}).subscribe({
      next: () => { this.unreadCount.set(0); this.markingAll.set(false); this.refresh(); },
      error: error => { this.error.set(this.errorMessage(error)); this.markingAll.set(false); },
    });
  }

  protected openNotification(item: NotificationRow): void {
    if (!this.isRead(item)) {
      this.api.patch<unknown>(`/notifications/${encodeURIComponent(String(item.id))}/read`, {}).subscribe({
        next: () => this.unreadCount.update(count => Math.max(0, count - 1)),
      });
    }
    this.open.set(false);
    void this.router.navigateByUrl(this.targetRoute(item));
  }

  protected seeAll(): void {
    this.open.set(false);
    void this.router.navigate(['/dashboard/notifications']);
  }

  protected icon(item: NotificationRow): string {
    const type = `${item.evenement ?? ''} ${item.type ?? ''} ${this.title(item)} ${this.message(item)}`.toLocaleLowerCase();
    if (/mission|course|chauffeur/.test(type)) return 'bi-car-front';
    if (/demande|request|sortie/.test(type)) return 'bi-inbox';
    if (/gestion|validation|traitement/.test(type)) return 'bi-clipboard-check';
    return 'bi-info-circle';
  }

  @HostListener('document:click', ['$event'])
  protected closeOnOutside(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && !target.closest('.notification-center')) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void { this.open.set(false); }

  private targetRoute(item: NotificationRow): string {
    const data = this.record(item.data);
    const route = item.url || item.route || data['url'] || data['route'];
    if (typeof route === 'string' && /^\/(dashboard|administration)(\/|$)/.test(route)) return route;
    const type = `${item.evenement ?? ''} ${item.type ?? ''} ${this.title(item)} ${String(data['type'] ?? '')} ${String(data['event'] ?? '')}`.toLocaleLowerCase();
    const roles = this.core.currentUser()?.roles?.map(role => role.nom.trim().toLocaleLowerCase()) ?? [];
    const isDriver = roles.some(role => ['chauffeur', 'pool_chauffeur'].includes(role));
    const isManager = roles.some(role => ['dag', 'super_admin'].includes(role));
    const isRequester = roles.some(role => ['agent', 'demandeur'].includes(role));

    const demandeId = item.demande_id ?? item.request_id ?? item.demande?.id ?? data['demande_id'] ?? data['request_id'] ?? this.record(data['demande'])['id'];
    if (demandeId != null) {
      if (isManager) return /historique|trait[ée]|valid[ée]|refus/.test(type)
        ? '/dashboard/gestion/demandes/historique'
        : '/dashboard/gestion/demandes';
      return `/dashboard/demandes/${encodeURIComponent(String(demandeId))}`;
    }
    const missionId = item.mission_id ?? item.course_id ?? item.mission?.id ?? item.course?.id ?? data['mission_id'] ?? data['course_id'] ?? data['course_preparation_id'] ?? this.record(data['mission'])['id'] ?? this.record(data['course'])['id'];
    if (missionId != null) return isDriver && !roles.includes('super_admin')
      ? `/dashboard/missions/${encodeURIComponent(String(missionId))}`
      : `/dashboard/gestion/courses/${encodeURIComponent(String(missionId))}`;
    if (/signalement|incident|alerte/.test(type)) return isDriver && !roles.includes('super_admin')
      ? '/dashboard/missions/signalement'
      : '/dashboard/gestion/alertes';
    if (/mission|course|chauffeur/.test(type)) return isDriver && !roles.includes('super_admin')
      ? '/dashboard/missions/planifiees'
      : '/dashboard/gestion/courses/brouillons';
    if (/demande|request|sortie/.test(type)) return isManager
      ? (/historique|trait[ée]|valid[ée]|refus/.test(type) ? '/dashboard/gestion/demandes/historique' : '/dashboard/gestion/demandes')
      : '/dashboard/demandes/suivi';
    if (isManager) return '/dashboard/gestion/demandes';
    if (isDriver) return '/dashboard/missions/planifiees';
    if (isRequester) return '/dashboard/demandes/suivi';
    return '/dashboard';
  }

  private record(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
  }

  private humanize(value: string): string {
    return value.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase());
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Une erreur est survenue. Réessayez.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    if (error.status === 403) return 'Vous ne pouvez pas consulter ces notifications.';
    return error.error?.message || 'Impossible de charger les notifications.';
  }
}
