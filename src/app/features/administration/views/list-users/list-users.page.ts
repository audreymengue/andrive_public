import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { IconComponent } from '../../components/icon';
import { RoleAssignDialog } from '../../components/role-assign-dialog';
import { USERS_BASE_PATH, User, fullName, isAdmin } from '../../models/user.model';
import { FlashService } from '../../services/flash.service';
import { UserService } from '../../services/user.service';

interface ContextMenu {
  x: number;
  y: number;
  user: User;
}

interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Observable<unknown>;
}

@Component({
  selector: 'app-list-users-page',
  imports: [ReactiveFormsModule, IconComponent, RoleAssignDialog],
  templateUrl: './list-users.page.html',
  styleUrls: ['../../styles/admin.shared.scss', './list-users.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListUsersPage {
  private readonly api = inject(UserService);
  private readonly router = inject(Router);
  protected readonly flash = inject(FlashService);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly page = signal(1);
  protected readonly perPage = 10;
  protected readonly total = signal(0);
  protected readonly lastPage = signal(1);
  protected readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.perPage + 1));
  protected readonly to = computed(() => Math.min(this.page() * this.perPage, this.total()));

  protected readonly menu = signal<ContextMenu | null>(null);
  protected readonly rolesTarget = signal<User | null>(null);
  protected readonly confirm = signal<Confirmation | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmError = signal<string | null>(null);

  protected readonly fullName = fullName;
  protected readonly isAdmin = isAdmin;

  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.page.set(1);
        this.reload();
      });

    this.refresh$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.api.list({ search: this.search.value, page: this.page(), perPage: this.perPage }).pipe(
            catchError(() => {
              this.loading.set(false);
              this.error.set('La liste des utilisateurs est indisponible pour le moment.');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.users.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(Math.max(1, res.meta.last_page));
        this.loading.set(false);
      });
  }

  // ---------- Navigation ----------
  protected create(): void {
    this.router.navigate([USERS_BASE_PATH, 'new']);
  }
  protected view(u: User): void {
    this.router.navigate([USERS_BASE_PATH, u.id]);
  }
  protected edit(u: User): void {
    this.router.navigate([USERS_BASE_PATH, u.id, 'edit']);
  }

  // ---------- Liste ----------
  protected reload(): void {
    this.refresh$.next();
  }
  protected goTo(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.page()) return;
    this.page.set(page);
    this.reload();
  }

  private replace(updated: User): void {
    this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
  }

  // ---------- Menu contextuel (clic droit) ----------
  protected openMenu(event: MouseEvent, user: User): void {
    event.preventDefault();
    const x = Math.min(event.clientX, window.innerWidth - 280);
    const y = Math.min(event.clientY, window.innerHeight - 250);
    this.menu.set({ x: Math.max(8, x), y: Math.max(8, y), user });
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.menu.set(null);
  }

  @HostListener('document:contextmenu', ['$event'])
  protected onDocumentContextMenu(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('tbody tr')) {
      this.menu.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menu.set(null);
    if (!this.busy()) {
      this.confirm.set(null);
      this.rolesTarget.set(null);
    }
  }

  // ---------- Actions avec confirmation ----------
  protected askToggle(u: User): void {
    const activate = !u.actif;
    const name = fullName(u);
    this.openConfirm({
      title: activate ? 'Activer ce compte ?' : 'Désactiver ce compte ?',
      message: activate
        ? `${name} pourra de nouveau se connecter à la plateforme.`
        : `${name} ne pourra plus se connecter tant que le compte n'est pas réactivé.`,
      confirmLabel: activate ? 'Activer' : 'Désactiver',
      danger: !activate,
      run: () =>
        this.api.setStatus(u.id, activate).pipe(
          tap((updated) => {
            this.replace(updated);
            this.flash.show(activate ? 'Compte activé.' : 'Compte désactivé.');
          }),
        ),
    });
  }

  protected askReset(u: User): void {
    this.openConfirm({
      title: 'Réinitialiser le mot de passe ?',
      message: `${fullName(u)} recevra le mot de passe par défaut et devra le modifier à sa prochaine connexion.`,
      confirmLabel: 'Réinitialiser',
      run: () =>
        this.api.resetPassword(u.id).pipe(
          tap((updated) => {
            this.replace(updated);
            this.flash.show('Mot de passe réinitialisé.');
          }),
        ),
    });
  }

  private openConfirm(c: Confirmation): void {
    this.confirmError.set(null);
    this.confirm.set(c);
  }

  protected closeConfirm(): void {
    if (!this.busy()) this.confirm.set(null);
  }

  protected runConfirm(): void {
    const c = this.confirm();
    if (!c) return;
    this.busy.set(true);
    this.confirmError.set(null);
    c.run().subscribe({
      next: () => {
        this.busy.set(false);
        this.confirm.set(null);
      },
      error: () => {
        this.busy.set(false);
        this.confirmError.set("L'action a échoué. Vérifiez votre connexion et réessayez.");
      },
    });
  }

  // ---------- Rôles ----------
  protected onRolesSaved(updated: User): void {
    this.replace(updated);
    this.rolesTarget.set(null);
    this.flash.show('Rôles mis à jour.');
  }
}