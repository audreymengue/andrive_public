import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="container py-5" style="max-width: 460px">
      <section class="card shadow-sm border-0"><div class="card-body p-4">
        <h1 class="h3 mb-2">Réinitialisation du mot de passe</h1>
        <p class="text-secondary">Saisissez votre adresse e-mail pour recevoir les instructions.</p>
        <label class="form-label" for="email">Adresse e-mail</label>
        <input class="form-control mb-3" id="email" type="email" autocomplete="email">
        <button class="btn btn-primary w-100" type="button" disabled>Envoyer — API à relier</button>
        <a class="d-inline-block mt-3" routerLink="/login">Retour à la connexion</a>
      </div></section>
    </main>
  `,
})
export class ResetPasswordPage {}
