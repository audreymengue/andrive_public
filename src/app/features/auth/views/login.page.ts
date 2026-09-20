import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CoreService } from '@/core/services/core.service';
import { MOCK_ACCOUNTS } from '@/core/mock/mock-users';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <main class="container py-5" style="max-width: 460px">
      <section class="card shadow-sm border-0">
        <div class="card-body p-4">
          <h1 class="h3 mb-2">Pool Chauffeur</h1>
          <p class="text-secondary">Connectez-vous à votre espace.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="mb-3">
              <label class="form-label" for="email">Adresse e-mail</label>
              <input class="form-control" id="email" type="email" autocomplete="email" formControlName="email">
            </div>
            <div class="mb-3">
              <label class="form-label" for="password">Mot de passe</label>
              <input class="form-control" id="password" type="password" autocomplete="current-password" formControlName="password">
            </div>

            @if (errorMessage()) {
              <div class="alert alert-danger py-2" role="alert">{{ errorMessage() }}</div>
            }

            <button class="btn btn-primary w-100" type="submit" [disabled]="form.invalid">Connexion</button>
          </form>

          <a class="d-inline-block mt-3" routerLink="/reinitialisation-mot-de-passe">Réinitialiser mon mot de passe</a>

          <hr>
          <p class="small text-secondary mb-2">Connexion rapide (démonstration) :</p>
          <div class="d-grid gap-2">
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="quickLogin('agent@aninf.cd')">Agent ANINF</button>
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="quickLogin('dag@aninf.cd')">DAG</button>
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="quickLogin('chauffeur@aninf.cd')">Pool Chauffeur</button>
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="quickLogin('admin@aninf.cd')">Administrateur</button>
          </div>
        </div>
      </section>
    </main>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly coreService = inject(CoreService);

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    this.attemptLogin(email, password);
  }

  /** Connexion en un clic avec un compte de démonstration (mot de passe imposé à "password"). */
  quickLogin(email: string): void {
    this.errorMessage.set(null);
    this.attemptLogin(email, 'password');
  }

  private attemptLogin(email: string, password: string): void {
    // ⚠️ TEMPORAIRE : recherche dans les comptes de démonstration.
    // À remplacer par : this.apiService.post('/login', { email, password })
    const account = MOCK_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );

    if (!account) {
      this.errorMessage.set('Identifiants incorrects.');
      return;
    }

    this.coreService.setToken('mock-token-' + account.user.id);
    this.coreService.setCurrentUser(account.user);

    if (account.user.mustChangePassword) {
      this.router.navigateByUrl('/reinitialisation-mot-de-passe');
    } else {
      this.router.navigateByUrl('/dashboard');
    }
  }
}