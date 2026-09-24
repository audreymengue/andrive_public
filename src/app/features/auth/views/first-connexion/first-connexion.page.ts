import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CoreService } from '@/core/services/core.service';
import { AuthService } from '../../../../core/services/auth.service';
// Validateur personnalisé : vérifie que les deux champs de mot de passe correspondent
function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const nouveauMotDePasse = control.get('nouveauMotDePasse')?.value;
    const confirmationMotDePasse = control.get('confirmationMotDePasse')?.value;

    if (!nouveauMotDePasse || !confirmationMotDePasse) {
      return null;
    }

    return nouveauMotDePasse === confirmationMotDePasse
      ? null
      : { passwordsMismatch: true };
  };
}

@Component({
  selector: 'app-first-connexion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './first-connexion.page.html',
  styleUrl: './first-connexion.page.scss'
})
export class FirstConnexionPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private coreService = inject(CoreService);

  isLoading = false;
  errorMessage = '';

  form = this.fb.group(
  {
    motDePasseActuel: this.fb.control('', [Validators.required]),
    nouveauMotDePasse: this.fb.control('', [
      Validators.required,
      Validators.minLength(8),
    ]),
    confirmationMotDePasse: this.fb.control('', [Validators.required]),
  },
  { validators: passwordsMatchValidator() }
);

onSubmit(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  const { motDePasseActuel, nouveauMotDePasse } = this.form.getRawValue();

  this.definirNouveauMotDePasse(motDePasseActuel!, nouveauMotDePasse!)
    .then((success) => {
      this.isLoading = false;

      if (!success) {
        this.errorMessage =
          'Impossible de mettre à jour le mot de passe. Veuillez réessayer.';
        return;
      }

      const user = this.coreService.currentUser();
      if (user) {
        this.coreService.setCurrentUser({ ...user, mustChangePassword: false });
      }

      this.router.navigate(['/dashboard']);
    })
    .catch(() => {
      this.isLoading = false;
      this.errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
    });
}

private definirNouveauMotDePasse(
  motDePasseActuel: string,
  nouveauMotDePasse: string
): Promise<boolean> {
  return firstValueFrom(
    this.authService.changePassword(motDePasseActuel, nouveauMotDePasse)
  ).then(() => true).catch(() => false);
}
}