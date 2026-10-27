import { Component, inject, signal } from '@angular/core';
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

  isLoading = signal(false);
  errorMessage = signal('');
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  form = this.fb.group(
    {
      nouveauMotDePasse: this.fb.control('', [
        Validators.required,
        Validators.minLength(8),
      ]),
      confirmationMotDePasse: this.fb.control('', [Validators.required]),
    },
    { validators: passwordsMatchValidator() }
  );

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update(value => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(value => !value);
  }

  onSubmit(): void {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { nouveauMotDePasse } = this.form.getRawValue();

    this.definirNouveauMotDePasse(nouveauMotDePasse!)
      .then((success) => {
        this.isLoading.set(false);

        if (!success) {
          this.errorMessage.set(
            'Impossible de mettre à jour le mot de passe. Veuillez réessayer.'
          );
          return;
        }

        const user = this.coreService.currentUser();
        if (user) {
          this.coreService.setCurrentUser({ ...user, mustChangePassword: false });
        }

        this.router.navigate(
          user?.roles?.some((role) => role.nom === 'demandeur')
            ? ['/dashboard/demandes/transport']
            : ['/dashboard']
        );
      })
      .catch(() => {
        this.isLoading.set(false);
        this.errorMessage.set('Une erreur est survenue. Veuillez réessayer.');
      });
  }

  private definirNouveauMotDePasse(nouveauMotDePasse: string): Promise<boolean> {
    return firstValueFrom(
      this.authService.changePassword(null, nouveauMotDePasse)
    ).then(() => true).catch(() => false);
  }
}
