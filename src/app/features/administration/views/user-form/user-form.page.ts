import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { DIRECTIONS, Role, USERS_BASE_PATH, User, fullName } from '../../models/user.model';
import { FlashService } from '../../services/flash.service';
import { RoleService } from '../../services/role.service';
import { UserService } from '../../services/user.service';

type Mode = 'create' | 'edit' | 'detail';
type FieldName = 'nom' | 'prenom' | 'email' | 'direction_id';

/**
 * Un seul composant pour les trois écrans :
 *  - create : ajout (boutons en bas à gauche). Crée l'utilisateur puis, si des rôles
 *    sont sélectionnés, les assigne dans un second appel (POST /users n'accepte pas les rôles).
 *  - edit   : édition (boutons en bas à gauche, email verrouillé)
 *  - detail : consultation (boutons en bas à droite). Le statut se change depuis la liste,
 *    pas ici : l'API ne l'accepte pas dans PUT /users/{id}.
 *
 * La page affiche une barre d'onglets identique à celle de la liste : un premier onglet
 * ramène vers « Liste des utilisateurs », le second, actif, affiche le contexte courant.
 */
@Component({
  selector: 'app-user-form-page',
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
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

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

  /** Titre affiché dans l'en-tête et dans l'onglet actif : inclut l'email une fois chargé. */
  protected readonly title = computed(() => {
    const u = this.user();
    if (this.mode === 'create') return 'Nouvel utilisateur';
    if (this.mode === 'edit') return u ? `Éditer : ${u.email}` : "Modifier l'utilisateur";
    return u ? `Détail : ${u.email}` : "Détail de l'utilisateur";
  });

  constructor() {
    this.applyModeRestrictions();
    this.rolesApi.list().subscribe({
      next: (roles) => this.allRoles.set(roles),
      error: () => this.rolesError.set('La liste des rôles est indisponible.'),
    });
    if (this.mode !== 'create') {
      this.load();
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.get(this.id).subscribe({
      next: (u) => {
        this.form.patchValue({
          nom: u.nom,
          prenom: u.prenom,
          email: u.email,
          direction_id: u.direction_id,
          roles: u.roles.map((r) => r.id),
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
      c.email.disable(); // l'identifiant de connexion ne change pas après création
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
    return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase();
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

  /** Lecture de la sélection multiple du <select> Habilitation. */
  protected onRolesSelectChange(select: HTMLSelectElement): void {
    const ids = Array.from(select.selectedOptions).map((o) => Number(o.value));
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
    const save$ = this.mode === 'create'
      ? this.api.create(payload).pipe(
          switchMap((result) => roles.length
            ? this.api.assignRoles(result.user.id, roles).pipe(
                switchMap((saved) => of({ saved, temporaryPassword: result.temporary_password })),
              )
            : of({ saved: result.user, temporaryPassword: result.temporary_password }),
          ),
        )
      : this.api.update(this.id, payload).pipe(
          switchMap((saved) => roles.length
            ? this.api.assignRoles(saved.id, roles).pipe(switchMap((updated) => of({ saved: updated, temporaryPassword: '' })))
            : of({ saved, temporaryPassword: '' }),
          ),
        );

    save$.subscribe({
        next: ({ saved, temporaryPassword }) => {
          this.flash.show(
            this.mode === 'create'
              ? `Utilisateur ${saved.email} créé. Mot de passe temporaire : ${temporaryPassword || 'à communiquer par l’administrateur'}. À changer à la première connexion.`
              : 'Modifications enregistrées.',
            15000,
          );
          this.cancel();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.handleError(err);
        },
      });
  }

  /** Réponse 422 de Laravel : { message, errors: { champ: [messages] } } */
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
