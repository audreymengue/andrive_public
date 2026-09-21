import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';

import { ROLE_OPTIONS, RoleCode, User, fullName } from '../models/user.model';
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
        <h2 id="roles-title">Attribuer des rôles</h2>
        <p class="modal-body">
          {{ name() }} ({{ user().login }})
        </p>

        <fieldset class="role-list">
          <legend class="sr-only">Rôles de l'utilisateur</legend>
          @for (role of options; track role.code) {
            <label class="role-option" [class.is-selected]="has(role.code)">
              <input
                type="checkbox"
                [checked]="has(role.code)"
                (change)="toggle(role.code, $any($event.target).checked)"
              />
              <span>
                <strong>{{ role.label }}</strong>
                <small>{{ role.description }}</small>
              </span>
            </label>
          }
        </fieldset>

        @if (selected().length === 0) {
          <p class="field-error" role="alert">Sélectionnez au moins un rôle.</p>
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

  readonly user = input.required<User>();
  readonly saved = output<User>();
  readonly closed = output<void>();

  protected readonly options = ROLE_OPTIONS;
  protected readonly selected = signal<RoleCode[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.selected.set([...this.user().roles]);
  }

  protected name(): string {
    return fullName(this.user());
  }

  protected has(code: RoleCode): boolean {
    return this.selected().includes(code);
  }

  protected toggle(code: RoleCode, checked: boolean): void {
    this.selected.update((current) =>
      checked ? [...new Set([...current, code])] : current.filter((c) => c !== code),
    );
  }

  protected save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.assignRoles(this.user().id, this.selected()).subscribe({
      next: (updated) => this.saved.emit(updated),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(err.error?.message ?? "Les rôles n'ont pas pu être enregistrés. Réessayez.");
      },
    });
  }
}