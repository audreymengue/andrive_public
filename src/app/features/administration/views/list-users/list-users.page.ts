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
import { HttpErrorResponse } from '@angular/common/http';
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

import { CoreService } from '@/core/services/core.service';
import { IconComponent } from '../../components/icon';
import {
  USERS_BASE_PATH,
  User,
  Paginated,
  fullName,
  isActif,
  roleNames,
} from '../../models/user.model';
import { FlashService } from '../../services/flash.service';
import { UserService } from '../../services/user.service';
import { RoleService, Role } from '../../services/role.service';

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
  requiresReason?: boolean;
  run: () => Observable<unknown>;
}

@Component({
  selector: 'app-list-users-page',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './list-users.page.html',
  styleUrls: ['../../styles/admin.shared.scss', './list-users.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListUsersPage {
  private readonly api = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly coreService = inject(CoreService);
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
  protected readonly roleReason = signal('');
  protected readonly roleCurrentPassword = signal('');
  protected readonly roleError = signal<string | null>(null);

  // Signal pour la modale de réinitialisation de mot de passe
  protected readonly resetPasswordTarget = signal<{ user: User; newPassword?: string; resetCompleted?: boolean; revealError?: string } | null>(null);
  protected readonly resetReason = signal('');
  protected readonly resetCurrentPassword = signal('');

  protected readonly allRoles = signal<Role[]>([]);
  protected readonly selectedRoleIds = signal<number[]>([]);

  protected readonly confirm = signal<Confirmation | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmError = signal<string | null>(null);
  protected readonly confirmReason = signal('');

  protected readonly fullName = fullName;
  protected readonly isActif = isActif;
  protected readonly roleNames = roleNames;

  private readonly refresh$ = new Subject<void>();

  constructor() {
    this.roleService.getRoles().subscribe({
      next: (res: any) => {
        const list = res?.data ?? res;
        this.allRoles.set(Array.isArray(list) ? list : []);
      },
      error: (err) => {
        console.error('>>> Erreur chargement rôles :', err);
      }
    });

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
            catchError((err: unknown) => {
              this.loading.set(false);
              if (err instanceof HttpErrorResponse && err.status === 401) {
                this.error.set('Session expirée ou non autorisée. Redirection...');
                this.coreService.logout();
                this.router.navigate(['/login']);
              } else {
                this.error.set('La liste des utilisateurs est indisponible.');
              }
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (res: Paginated<User>) => {
          this.users.set(res.data);
          this.total.set(res.meta.total);
          this.lastPage.set(Math.max(1, res.meta.last_page));
          this.loading.set(false);
        },
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

  protected openRoles(u: User): void {
    this.rolesTarget.set(u);
    const currentIds = Array.isArray(u.roles) ? u.roles.map((r: any) => r.id ?? r) : [];
    this.selectedRoleIds.set(currentIds.slice(0, 1));
    this.roleReason.set('');
    this.roleCurrentPassword.set('');
    this.roleError.set(null);
  }

  protected closeRoles(): void {
    if (!this.busy()) {
      this.rolesTarget.set(null);
      this.roleError.set(null);
    }
  }

  protected requiresSuperAdminReauthentication(): boolean {
    const target = this.rolesTarget();
    if (!target) return false;
    const superAdmin = this.allRoles().find((role) => role.nom?.toLocaleLowerCase() === 'super_admin');
    return !!superAdmin && this.selectedRoleIds().includes(superAdmin.id)
      && !(target.roles ?? []).some((role: any) => (role.id ?? role) === superAdmin.id);
  }

  protected hasRole(roleId: number): boolean {
    return this.selectedRoleIds().includes(roleId);
  }

  protected onRolesSelectChange(select: HTMLSelectElement): void {
    const id = Number(select.value);
    const ids = select.value && Number.isFinite(id) ? [id] : [];
    this.selectedRoleIds.set(ids);
  }

  protected saveUserRoles(): void {
    const target = this.rolesTarget();
    if (!target) return;
    const motif = this.roleReason().trim();
    const currentPassword = this.roleCurrentPassword();
    if (!motif) {
      this.roleError.set('Indiquez le motif de cette attribution.');
      return;
    }
    if (this.requiresSuperAdminReauthentication() && !currentPassword) {
      this.roleError.set('Saisissez votre mot de passe administrateur pour attribuer le rôle super_admin.');
      return;
    }

    this.roleError.set(null);
    this.busy.set(true);
    this.api.assignRoles(target.id, this.selectedRoleIds(), {
      version: target.lock_version ?? 0,
      motif,
      ...(this.requiresSuperAdminReauthentication() ? { currentPassword } : {}),
    }).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.rolesTarget.set(null);
        this.replace(updated);
        this.flash.show('Rôles mis à jour avec succès.');
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.roleError.set(err.error?.message || "Erreur lors de la mise à jour des rôles.");
      }
    });
  }

  // --- Gestion de la réinitialisation du mot de passe ---
  protected resetPassword(u: User): void {
    this.resetPasswordTarget.set({ user: u });
    this.resetReason.set('');
    this.resetCurrentPassword.set('');
  }

  /** Alias appelé par le template HTML */
  protected askReset(u: User): void {
    this.resetPassword(u);
  }

  protected closeResetPassword(): void {
    if (!this.busy()) {
      this.resetPasswordTarget.set(null);
      this.resetReason.set('');
      this.resetCurrentPassword.set('');
    }
  }

  protected confirmResetPassword(): void {
    const target = this.resetPasswordTarget();
    if (!target) return;
    const motif = this.resetReason().trim();
    const currentPassword = this.resetCurrentPassword();
    if (!motif || !currentPassword) {
      this.resetPasswordTarget.set({ ...target, revealError: 'Le motif et votre mot de passe administrateur sont obligatoires.' });
      return;
    }

    this.busy.set(true);
    this.resetPasswordTarget.set({ ...target, revealError: undefined });
    this.api.resetPassword(target.user.id, { version: target.user.lock_version ?? 0, motif, currentPassword }).subscribe({
      next: (updatedUser) => {
        this.replace(updatedUser);
        this.resetPasswordTarget.set({ user: updatedUser, resetCompleted: true });
        this.revealResetPassword(updatedUser, motif, currentPassword);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.resetPasswordTarget.set({ ...target, revealError: err.error?.message || "Erreur lors de la réinitialisation." });
      }
    });
  }

  protected revealResetPassword(user?: User, motif?: string, currentPassword?: string): void {
    const target = this.resetPasswordTarget();
    const account = user ?? target?.user;
    const reason = motif ?? this.resetReason().trim();
    const password = currentPassword ?? this.resetCurrentPassword();
    if (!account || !reason || !password) return;
    this.busy.set(true);
    this.api.revealTemporaryPassword(account.id, account.password_generation ?? 0, account.lock_version ?? 0, password, reason).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.resetPasswordTarget.set({ user: account, resetCompleted: true, newPassword: result.temporary_password });
        this.flash.show(`Le mot de passe de ${account.email} a été réinitialisé.`);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.resetPasswordTarget.set({ user: account, resetCompleted: true, revealError: err.error?.message || 'Le mot de passe a été réinitialisé, mais son affichage a échoué.' });
      },
    });
  }

  protected copyPassword(password: string): void {
    navigator.clipboard.writeText(password).then(
      () => this.flash.show('Mot de passe copié dans le presse-papier !'),
      () => this.flash.show('Copie impossible. Sélectionnez et copiez le mot de passe manuellement.'),
    );
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
    this.users.update((list: User[]) => list.map((u: User) => (u.id === updated.id ? updated : u)));
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
      this.resetPasswordTarget.set(null);
      this.roleCurrentPassword.set('');
      this.resetCurrentPassword.set('');
      this.resetReason.set('');
    }
  }

  protected toggleStatus(u: User): void {
    const activate = !this.isActif(u);
    this.confirmReason.set('');
    this.openConfirm({
      title: activate ? 'Activer le compte' : 'Désactiver le compte',
      message: `Confirmez-vous l’opération pour ${fullName(u)} (${u.email}) ?`,
      confirmLabel: activate ? 'Activer' : 'Désactiver',
      danger: !activate,
      requiresReason: true,
      run: () => (activate ? this.api.activate(u.id, { version: u.lock_version ?? 0, motif: this.confirmReason().trim() }) : this.api.deactivate(u.id, { version: u.lock_version ?? 0, motif: this.confirmReason().trim() })).pipe(
        tap((updated) => {
          this.replace(updated);
          this.flash.show(activate ? 'Compte activé.' : 'Compte désactivé.');
        }),
      ),
    });
  }

  private openConfirm(c: Confirmation): void {
    this.confirmError.set(null);
    this.confirmReason.set('');
    this.confirm.set(c);
  }

  protected closeConfirm(): void {
    if (!this.busy()) this.confirm.set(null);
  }

  protected runConfirm(): void {
    const c = this.confirm();
    if (!c) return;
    if (c.requiresReason && !this.confirmReason().trim()) {
      this.confirmError.set('Le motif est obligatoire.');
      return;
    }
    this.busy.set(true);
    this.confirmError.set(null);
    c.run().subscribe({
      next: () => {
        this.busy.set(false);
        this.confirm.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.confirmError.set(err.error?.message ?? "L'action a échoué.");
      },
    });
  }
}
