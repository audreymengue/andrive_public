import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { DIRECTIONS, Role, USERS_BASE_PATH, User, fullName } from '../../models/user.model';
import { FlashService } from '../../services/flash.service';
import { RoleService } from '../../services/role.service';
import { UserService } from '../../services/user.service';

type Mode = 'create' | 'edit' | 'detail';
type FieldName = 'nom' | 'prenom' | 'email' | 'direction_id';

@Component({
  selector: 'app-user-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.page.html',
  styleUrls: ['../../styles/admin.shared.scss', './user-form.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(UserService);
  private readonly rolesApi = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flash = inject(FlashService);

  protected readonly mode: Mode = this.route.snapshot.data['mode'] ?? 'create';

  // Sécurisation de la récupération de l'ID (on gère le cas où il est absent)
  private readonly rawId = this.route.snapshot.paramMap.get('id');
  private readonly id = this.rawId ? Number(this.rawId) : null;

  protected readonly listPath = USERS_BASE_PATH;
  protected readonly directions = DIRECTIONS;

  protected readonly allRoles = signal<Role[]>([]);
  protected readonly rolesError = signal<string | null>(null);

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal(this.mode !== 'create');
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    direction_id: this.fb.control<number | null>(null, Validators.required),
    roles: [[] as number[]],
  });

  protected readonly title = computed(() => {
    const u = this.user();
    if (this.mode === 'create') return 'Nouvel utilisateur';
    if (this.mode === 'edit') return u ? `Éditer : ${u.email}` : "Modifier l'utilisateur";
    return u ? `Détail : ${u.email}` : "Détail de l'utilisateur";
  });

  constructor() {
    this.applyModeRestrictions();

    this.rolesApi.list().subscribe({
      next: (roles) => this.allRoles.set(Array.isArray(roles) ? roles : []),
      error: () => this.rolesError.set('La liste des rôles est indisponible.'),
    });

    if (this.mode !== 'create') {
      if (!this.id || isNaN(this.id)) {
        this.error.set("Identifiant d'utilisateur invalide.");
        this.loading.set(false);
        return;
      }

      this.load();
    }
  }

  protected load(): void {
    if (!this.id) return;

    this.loading.set(true);
    this.loadError.set(false);

    this.api.get(this.id).subscribe({
      next: (rep: any) => {
        const u = rep?.data ?? rep;

        this.form.patchValue({
          nom: u.nom,
          prenom: u.prenom,
          email: u.email,
          direction_id: u.direction_id,
          roles: Array.isArray(u.roles) ? u.roles.map((r: any) => r.id) : [],
        });

        this.user.set(u);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  private applyModeRestrictions(): void {
    const c = this.form.controls;
    if (this.mode === 'edit') {
      c.email.disable();
    }
    if (this.mode === 'detail') {
      c.nom.disable();
      c.prenom.disable();
      c.email.disable();
      c.direction_id.disable();
      c.roles.disable();
    }
  }

  protected name(u: User): string {
    return fullName(u);
  }

  protected initials(u: User): string {
    return `${u.prenom?.charAt(0) ?? ''}${u.nom?.charAt(0) ?? ''}`.toUpperCase();
  }

  protected hasRole(id: number): boolean {
    return this.form.controls.roles.value.includes(id);
  }

  protected roleLabel(id: number): string {
    return this.allRoles().find((r) => r.id === id)?.nom ?? String(id);
  }

  protected directionLabel(id: number | null): string {
    if (id === null) return '—';
    const found = this.directions.find((d) => d.id === id);
    return found ? `${found.nom} (${found.code})` : `Direction #${id}`;
  }

  protected onRolesSelectChange(select: HTMLSelectElement): void {
    const ids = select.value ? [Number(select.value)] : [];
    this.form.controls.roles.setValue(ids);
    this.form.controls.roles.markAsDirty();
  }

  protected errorOf(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || control.dirty) || !control.errors) return null;
    if (control.errors['server']) return control.errors['server'];
    if (control.errors['required']) return 'Ce champ est obligatoire.';
    if (control.errors['maxlength']) return 'Ce champ est trop long (100 caractères maximum).';
    if (control.errors['email']) return 'Saisissez une adresse email valide.';
    return null;
  }

  protected cancel(): void {
    this.router.navigate([this.listPath]);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);

    const { roles, ...payload } = this.form.getRawValue();

    if (this.mode === 'create') {
      this.api.create(payload).pipe(
        switchMap((created) => {
          const assignRoles$ = roles.length
            ? this.api.assignRoles(created.user.id, roles)
            : of(created.user);
          return assignRoles$.pipe(map(() => created));
        })
      ).subscribe({
        next: (created) => {
          this.flash.show(
            `Utilisateur ${created.user.email} créé. Mot de passe temporaire : ${created.temporary_password}. À changer à la première connexion.`,
            15000
          );
          this.cancel();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.handleError(err);
        },
      });
    } else {
      if (!this.id) {
        this.saving.set(false);
        this.error.set("Impossible de mettre à jour : ID utilisateur manquant.");
        return;
      }

      this.api.update(this.id, payload)
        .pipe(
          switchMap((savedResponse: any) => {
            // Extraction sécurisée de l'ID utilisateur au cas où l'API renvoie { data: { id: ... } }
            const updatedUser = savedResponse?.data ?? savedResponse;
            const targetId = updatedUser?.id ?? this.id;

            return this.form.controls.roles.dirty
              ? this.api.assignRoles(targetId, roles)
              : of(savedResponse);
          })
        )
        .subscribe({
          next: () => {
            this.flash.show('Modifications enregistrées.', 5000);
            this.cancel();
          },
          error: (err: HttpErrorResponse) => {
            this.saving.set(false);
            this.handleError(err);
          },
        });
    }
  }

  private handleError(err: HttpErrorResponse): void {
    const fieldErrors = err.status === 422 ? err.error?.errors : null;
    if (fieldErrors) {
      for (const [field, messages] of Object.entries<string[]>(fieldErrors)) {
        this.form.get(field)?.setErrors({ server: messages[0] });
      }
      this.form.markAllAsTouched();
      this.error.set('Certaines informations sont à corriger.');
      return;
    }
    this.error.set(err.error?.message ?? "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.");
  }
}
