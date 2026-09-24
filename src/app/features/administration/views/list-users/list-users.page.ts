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
import { USERS_BASE_PATH, User, fullName, isActif, roleNames } from '../../models/user.model';
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
  protected readonly isActif = isActif;
  protected readonly roleNames = roleNames;

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

  protected profilOf(u: User): string {
    const names = roleNames(u);
    return names.length ? names.join(', ') : '-';
  }

  protected create(): void {
    this.router.navigate([USERS_BASE_PATH, 'new']);
  }
  protected view(u: User): void {
    this.router.navigate([USERS_BASE_PATH, u.id]);
  }
  protected edit(u: User): void {
    this.router.navigate([USERS_BASE_PATH, u.id, 'edit']);
  }

  protected reload(): void {
    this.refresh$.next();
  }
  protected goTo(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.page()) return;
    this.page.set(page);
    this.reload();
  }
  protected goToFirst(): void {
    this.goTo(1);
  }
  protected goToLast(): void {
    this.goTo(this.lastPage());
  }

  private replace(updated: User): void {
    this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
  }

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

  protected toggleStatus(u: User): void {
    const activate = !this.isActif(u);
    (activate ? this.api.activate(u.id) : this.api.deactivate(u.id)).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.flash.show(activate ? 'Compte active.' : 'Compte desactive.');
      },
      error: () => {
        this.flash.show("L'action a echoue. Verifiez votre connexion et reessayez.");
      },
    });
  }

  protected askReset(u: User): void {
    this.openConfirm({
      title: 'Reinitialiser le mot de passe ?',
      message: `${fullName(u)} recevra le mot de passe par defaut et devra le modifier a sa prochaine connexion.`,
      confirmLabel: 'Reinitialiser',
      run: () =>
        this.api.resetPassword(u.id).pipe(
          tap(() => {
            this.flash.show('Mot de passe reinitialise.');
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
        this.confirmError.set("L'action a echoue. Verifiez votre connexion et reessayez.");
      },
    });
  }

  protected onRolesSaved(updated: User): void {
    this.replace(updated);
    this.rolesTarget.set(null);
    this.flash.show('Roles mis a jour.');
  }
}
