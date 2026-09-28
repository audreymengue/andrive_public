import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';

import { Role, User, fullName } from '../models/user.model';
import { RoleService } from '../services/role.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-role-assign-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../styles/admin.shared.scss',
  template: `
    <div class="overlay" (click)="closed.emit()">
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roles-title"
        (click)="$event.stopPropagation()"
      >
        <h2 id="roles-title">Attribuer des roles</h2>
        <p class="modal-body">
          {{ name() }} ({{ user().email }})
        </p>

        @if (loadingRoles()) {
          <p class="muted" role="status">Chargement des roles...</p>
        } @else {
          <fieldset class="role-list">
            <legend class="sr-only">Roles de l'utilisateur</legend>
            @for (role of allRoles(); track role.id) {
              <label class="role-option" [class.is-selected]="has(role.id)">
                <input
                  type="checkbox"
                  [checked]="has(role.id)"
                  (change)="toggle(role.id, $any($event.target).checked)"
                />
                <span>
                  <strong>{{ role.nom }}</strong>
                </span>
              </label>
            }
          </fieldset>
        }

        @if (selected().length === 0) {
          <p class="field-error" role="alert">Selectionnez au moins un role.</p>
        }
        @if (error(); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">Annuler</button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="selected().length === 0 || saving()"
            (click)="save()"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RoleAssignDialog implements OnInit {
  private readonly api = inject(UserService);
  private readonly rolesApi = inject(RoleService);

  readonly user = input.required<User>();
  readonly saved = output<User>();
  readonly closed = output<void>();

  protected readonly allRoles = signal<Role[]>([]);
  protected readonly loadingRoles = signal(true);
  protected readonly selected = signal<number[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.selected.set(this.user().roles.map((r) => r.id));
    this.rolesApi.list().subscribe({
      next: (roles) => {
        this.allRoles.set(roles);
        this.loadingRoles.set(false);
      },
      error: () => {
        this.error.set("La liste des roles n'a pas pu etre chargee.");
        this.loadingRoles.set(false);
      },
    });
  }

  protected name(): string {
    return fullName(this.user());
  }

  protected has(id: number): boolean {
    return this.selected().includes(id);
  }

  protected toggle(id: number, checked: boolean): void {
    this.selected.update((current) =>
      checked ? [...new Set([...current, id])] : current.filter((c) => c !== id),
    );
  }

  protected save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.assignRoles(this.user().id, this.selected()).subscribe({
      next: (updated) => this.saved.emit(updated),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(err.error?.message ?? "Les roles n'ont pas pu etre enregistres. Reessayez.");
      },
    });
  }
}
