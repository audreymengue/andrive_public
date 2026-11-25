import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/core/services/api.service';
import { CoreService } from '@/core/services/core.service';

interface NotificationItem {
  // Laravel notifications commonly use UUIDs as primary keys.
  id: string | number;
  titre?: string | null;
  title?: string | null;
  message?: string | null;
  contenu?: string | null;
  type?: string | null;
  evenement?: string | null;
  reference_demande?: string | null;
  created_at?: string | null;
  date?: string | null;
  lu?: boolean | number | string | null;
  lue?: boolean | number | string | null;
  read?: boolean | null;
  read_at?: string | null;
  data?: Record<string, unknown> | null;
  url?: string | null;
  route?: string | null;
  action_url?: string | null;
  actionUrl?: string | null;
  demande_id?: string | number | null;
  request_id?: string | number | null;
  mission_id?: string | number | null;
  course_id?: string | number | null;
  demande?: { id?: string | number | null } | null;
  mission?: { id?: string | number | null } | null;
  course?: { id?: string | number | null } | null;
}

interface NotificationPage {
  items: NotificationItem[];
  currentPage: number;
  lastPage: number;
  total: number;
}

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly core = inject(CoreService);
  protected readonly notifications = signal<NotificationItem[]>([]);
  protected readonly unreadCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly unreadOnly = signal(false);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly markingIds = signal<Set<string | number>>(new Set());
  protected readonly markingAll = signal(false);
  private readonly perPage = 12;

  ngOnInit(): void { this.refresh(); }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new HttpParams()
      .set('page', this.page())
      .set('per_page', this.perPage)
      .set('non_lues', this.unreadOnly());
    this.api.get<unknown>('/notifications', { params }).subscribe({
      next: (response) => {
        const result = this.parsePage(response);
        this.notifications.set(result.items);
        this.page.set(result.currentPage);
        this.lastPage.set(result.lastPage);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.errorMessage(err));
        this.loading.set(false);
      },
    });
    this.loadUnreadCount();
  }

  protected setFilter(unreadOnly: boolean): void {
    if (this.unreadOnly() === unreadOnly) return;
    this.unreadOnly.set(unreadOnly);
    this.page.set(1);
    this.refresh();
  }

  protected markRead(item: NotificationItem): void {
    if (item.id === '' || this.isRead(item) || this.markingIds().has(item.id)) return;
    this.markingIds.update(ids => new Set(ids).add(item.id));
    this.api.patch<unknown>(`/notifications/${encodeURIComponent(String(item.id))}/read`, {}).subscribe({
      next: () => {
        this.notifications.update(items => items.map(row => row.id === item.id ? { ...row, lu: true, lue: true, read: true } : row));
        this.unreadCount.update(count => Math.max(0, count - 1));
        this.markingIds.update(ids => { const next = new Set(ids); next.delete(item.id); return next; });
        if (this.unreadOnly()) this.refresh();
      },
      error: (err: unknown) => {
        this.markingIds.update(ids => { const next = new Set(ids); next.delete(item.id); return next; });
        this.error.set(this.errorMessage(err));
      },
    });
  }

  protected markAllRead(): void {
    if (!this.unreadCount() || this.markingAll()) return;
    this.markingAll.set(true);
    this.api.patch<unknown>('/notifications/read-all', {}).subscribe({
      next: () => {
        this.notifications.update(items => items.map(item => ({ ...item, lu: true, lue: true, read: true })));
        this.unreadCount.set(0);
        this.markingAll.set(false);
        if (this.unreadOnly()) this.refresh();
      },
      error: (err: unknown) => { this.markingAll.set(false); this.error.set(this.errorMessage(err)); },
    });
  }

  protected changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.lastPage()) return;
    this.page.set(next);
    this.refresh();
  }

  protected isRead(item: NotificationItem): boolean {
    return item.read_at != null || item.lu === true || item.lu === 1 || item.lu === '1' || item.lue === true || item.lue === 1 || item.lue === '1' || item.read === true;
  }

  protected title(item: NotificationItem): string {
    const event = item.evenement || item.type || '';
    const titles: Record<string, string> = {
      COURSE_ASSIGNEE: 'Nouvelle mission affectée',
      DEMANDE_VALIDEE: 'Demande validée',
      DEMANDE_SOUMISE: 'Nouvelle demande à traiter',
      DEMANDE_RESOUMISE: 'Demande modifiée à revalider',
      COURSE_DEMARREE: 'Mission démarrée',
      COURSE_TERMINEE: 'Mission terminée',
    };
    return item.titre || item.title || titles[event.toLocaleUpperCase()] || event.replace(/[._-]+/g, ' ') || 'Notification';
  }

  protected message(item: NotificationItem): string {
    return item.message || item.contenu || this.dataMessage(item.data) || (item.reference_demande ? `Référence ${item.reference_demande}` : 'Aucun détail supplémentaire.');
  }

  protected date(item: NotificationItem): string | null { return item.created_at || item.date || null; }

  protected openNotification(item: NotificationItem): void {
    if (!this.isRead(item)) this.markRead(item);
    void this.router.navigateByUrl(this.targetRoute(item));
  }

  private targetRoute(item: NotificationItem): string {
    const data = this.record(item.data);
    const explicit = [item.url, item.route, item.action_url, item.actionUrl, data['url'], data['route'], data['action_url'], data['actionUrl']]
      .find(value => typeof value === 'string' && value.trim());
    const safeRoute = this.internalRoute(explicit);
    if (safeRoute) return safeRoute;

    const demandeId = this.firstId(item.demande_id, item.request_id, item.demande?.id, data['demande_id'], data['request_id'], this.record(data['demande'])['id']);
    const isDriver = this.hasAnyRole('chauffeur', 'pool_chauffeur');
    const isManager = this.hasAnyRole('dag', 'super_admin');
    const type = `${item.evenement ?? ''} ${item.type ?? ''} ${String(data['type'] ?? '')} ${String(data['event'] ?? '')}`.toLocaleLowerCase();
    if (demandeId) {
      if (isManager) return /historique|trait[ée]|valid[ée]|refus/.test(type)
        ? '/dashboard/gestion/demandes/historique'
        : '/dashboard/gestion/demandes';
      return `/dashboard/demandes/${encodeURIComponent(demandeId)}`;
    }

    const missionId = this.firstId(item.mission_id, item.mission?.id, data['mission_id'], this.record(data['mission'])['id']);
    const courseId = this.firstId(item.course_id, item.course?.id, data['course_id'], data['course_preparation_id'], this.record(data['course'])['id']);
    if (missionId) {
      if (isDriver) return `/dashboard/missions/${encodeURIComponent(missionId)}`;
      if (isManager) return `/dashboard/gestion/courses/${encodeURIComponent(missionId)}`;
      return '/dashboard/demandes/suivi';
    }
    if (courseId) {
      if (isDriver) return `/dashboard/missions/${encodeURIComponent(courseId)}`;
      if (isManager) return `/dashboard/gestion/courses/${encodeURIComponent(courseId)}`;
      return '/dashboard/demandes/suivi';
    }
    if (/signalement|incident|alerte/.test(type)) return isDriver ? '/dashboard/missions/signalement' : isManager ? '/dashboard/gestion/alertes' : '/dashboard/demandes/suivi';
    if (/mission|course|chauffeur/.test(type)) return isDriver ? '/dashboard/missions/planifiees' : isManager ? '/dashboard/gestion/courses/brouillons' : '/dashboard/demandes/suivi';
    if (/demande|request|sortie/.test(type) || /\b\d{2}-\d{2}-\d{2}-\d{4}\b/.test(this.message(item))) {
      return isManager ? '/dashboard/gestion/demandes/historique' : '/dashboard/demandes/suivi';
    }
    return isDriver ? '/dashboard/missions/planifiees' : isManager ? '/dashboard/gestion/demandes' : '/dashboard/demandes/suivi';
  }

  private internalRoute(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const route = value.trim();
    if (/^https?:\/\//i.test(route) || route.startsWith('//')) return null;
    const normalized = route.startsWith('/') ? route : `/${route}`;
    return /^\/(dashboard|administration)(\/|$)/.test(normalized) ? normalized : null;
  }

  private firstId(...values: unknown[]): string | null {
    const value = values.find(candidate => (typeof candidate === 'string' && candidate.trim().length > 0) || (typeof candidate === 'number' && Number.isFinite(candidate)));
    return value === undefined || value === null ? null : String(value);
  }

  private hasAnyRole(...roles: string[]): boolean {
    const currentRoles = this.core.currentUser()?.roles?.map(role => role.nom.trim().toLocaleLowerCase()) ?? [];
    return roles.some(role => currentRoles.includes(role));
  }

  private loadUnreadCount(): void {
    this.api.get<unknown>('/notifications/unread-count').subscribe({
      next: response => this.unreadCount.set(this.parseCount(response)),
    });
  }

  private parsePage(response: unknown): NotificationPage {
    const root = this.record(response);
    const body = this.record(root['data']);
    const rawItems = Array.isArray(root['data']) ? root['data'] : Array.isArray(body['data']) ? body['data'] : Array.isArray(body['notifications']) ? body['notifications'] : Array.isArray(root['notifications']) ? root['notifications'] : [];
    const meta = this.record(root['meta'] ?? body['meta'] ?? body);
    const currentPage = this.number(meta['current_page'] ?? meta['currentPage'], this.page());
    return {
      items: rawItems.map((item, index) => {
        const row = this.record(item);
        const id = typeof row['id'] === 'string' || typeof row['id'] === 'number' ? row['id'] : '';
        return { ...row, id } as NotificationItem;
      }),
      currentPage,
      lastPage: Math.max(1, this.number(meta['last_page'] ?? meta['lastPage'], 1)),
      total: this.number(meta['total'], rawItems.length),
    };
  }

  private parseCount(response: unknown): number {
    const root = this.record(response);
    const data = this.record(root['data']);
    return Math.max(0, this.number(root['count'] ?? root['unread_count'] ?? data['count'] ?? data['unread_count'] ?? (typeof root['data'] === 'number' ? root['data'] : undefined), 0));
  }

  private dataMessage(data: Record<string, unknown> | null | undefined): string {
    if (!data) return '';
    const candidate = data['message'] ?? data['description'] ?? data['contenu'];
    return typeof candidate === 'string' ? candidate : '';
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private number(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'Une erreur est survenue. Réessayez.';
    if (error.status === 0) return 'Le serveur API est injoignable.';
    if (error.status === 403) return 'Vous n’avez pas la permission de gérer ces notifications.';
    return error.error?.message || 'Impossible de traiter la demande. Réessayez.';
  }
}
