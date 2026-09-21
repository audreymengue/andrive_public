import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  PROFIL_OPTIONS,
  ProfilCode,
  ROLE_OPTIONS,
  RoleCode,
  USERS_BASE_PATH,
  User,
  fullName,
} from '../../models/user.model';
import { FlashService } from '../../services/flash.service';
import { UserService } from '../../services/user.service';

type Mode = 'create' | 'edit' | 'detail';
type FieldName = 'nom' | 'prenom' | 'login' | 'profil' | 'roles';

/**
 * Un seul composant pour les trois écrans :
 *  - create : ajout (boutons en bas à gauche)
 *  - edit   : édition (boutons en bas à gauche, login verrouillé)
 *  - detail : consultation (boutons en bas à droite, seuls statut et profil modifiables)
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly flash = inject(FlashService);

  protected readonly mode: Mode = this.route.snapshot.data['mode'] ?? 'create';
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly listPath = USERS_BASE_PATH;
  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly profilOptions = PROFIL_OPTIONS;

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal(this.mode !== 'create');
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    login: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{3,50}$/)]],
    actif: [true],
    profil: ['AGENT' as ProfilCode, Validators.required],
    roles: [['ROLE_USER'] as RoleCode[], Validators.required], // tableau vide => invalide
  });

  protected readonly title: string =
    this.mode === 'create'
      ? 'Nouvel utilisateur'
      : this.mode === 'edit'
        ? "Modifier l'utilisateur"
        : "Détail de l'utilisateur";

  constructor() {
    this.applyModeRestrictions();
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
          login: u.login,
          actif: u.actif,
          profil: u.profil,
          roles: u.roles,
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
      c.login.disable(); // l'identifiant de connexion ne change pas après création
    }
    if (this.mode === 'detail') {
      c.nom.disable();
      c.prenom.disable();
      c.login.disable();
      c.roles.disable();
    }
  }

  protected name(u: User): string {
    return fullName(u);
  }

  protected initials(u: User): string {
    return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase();
  }

  protected hasRole(code: RoleCode): boolean {
    return this.form.controls.roles.value.includes(code);
  }

  protected roleLabel(code: RoleCode): string {
    return this.roleOptions.find((r) => r.code === code)?.label ?? code;
  }

  protected toggleRole(code: RoleCode, checked: boolean): void {
    const control = this.form.controls.roles;
    const next = checked
      ? [...new Set([...control.value, code])]
      : control.value.filter((c) => c !== code);
    control.setValue(next);
    control.markAsDirty();
    control.markAsTouched();
  }

  protected errorOf(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || control.dirty) || !control.errors) return null;
    if (control.errors['server']) return control.errors['server'];
    if (control.errors['required']) {
      return name === 'roles' ? 'Sélectionnez au moins un rôle.' : 'Ce champ est obligatoire.';
    }
    if (control.errors['maxlength']) return 'Ce champ est trop long (100 caractères maximum).';
    if (control.errors['pattern']) {
      return 'Utilisez 3 à 50 caractères : lettres, chiffres, point, tiret ou underscore.';
    }
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

    const payload = this.form.getRawValue();
    const request$ =
      this.mode === 'create' ? this.api.create(payload) : this.api.update(this.id, payload);

    request$.subscribe({
      next: (saved) => {
        this.flash.show(
          this.mode === 'create'
            ? `Utilisateur ${saved.login} créé. Son mot de passe par défaut est à changer à la première connexion.`
            : 'Modifications enregistrées.',
          5000,
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