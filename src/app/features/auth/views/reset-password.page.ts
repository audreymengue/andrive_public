import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CoreService } from '@/core/services/core.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { mismatch: true }
    : null;
}

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <main class="container py-5" style="max-width: 460px">
      <section class="card shadow-sm border-0"><div class="card-body p-4">
        <h1 class="h3 mb-2">Réinitialisation du mot de passe</h1>
        <p class="text-secondary">
          @if (coreService.currentUser()?.mustChangePassword) {
            C'est votre première connexion : choisissez un nouveau mot de passe personnel.
          } @else {
            Choisissez un nouveau mot de passe.
          }
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="mb-3">
            <label class="form-label" for="newPassword">Nouveau mot de passe</label>
            <input class="form-control" id="newPassword" type="password" formControlName="newPassword">
            @if (form.get('newPassword')?.touched && form.get('newPassword')?.hasError('minlength')) {
              <div class="form-text text-danger">8 caractères minimum.</div>
            }
          </div>
          <div class="mb-3">
            <label class="form-label" for="confirmPassword">Confirmer le mot de passe</label>
            <input class="form-control" id="confirmPassword" type="password" formControlName="confirmPassword">
            @if (form.touched && form.hasError('mismatch')) {
              <div class="form-text text-danger">Les mots de passe ne correspondent pas.</div>
            }
          </div>

          @if (successMessage()) {
            <div class="alert alert-success py-2" role="alert">{{ successMessage() }}</div>
          }

          <button class="btn btn-primary w-100" type="submit" [disabled]="form.invalid">Valider</button>
        </form>

        <a class="d-inline-block mt-3" routerLink="/login">Retour à la connexion</a>
      </div></section>
    </main>
  `,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly coreService = inject(CoreService);

  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch }
  );

  submit(): void {
    // ⚠️ TEMPORAIRE : simule la mise à jour côté client.
    // À remplacer par : this.apiService.post('/reset-password', { ...this.form.getRawValue() })
    const user = this.coreService.currentUser();
    if (user) {
      this.coreService.setCurrentUser({ ...user, mustChangePassword: false });
    }

    this.successMessage.set('Mot de passe mis à jour.');
    setTimeout(() => this.router.navigateByUrl('/dashboard'), 800);
  }
}