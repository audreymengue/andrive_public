import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="container py-5" style="max-width: 460px">
      <section class="card shadow-sm border-0">
        <div class="card-body p-4">
          <h1 class="h3 mb-2">Pool Chauffeur</h1>
          <p class="text-secondary">Connectez-vous à votre espace.</p>
          <form>
            <div class="mb-3"><label class="form-label" for="email">Adresse e-mail</label><input class="form-control" id="email" type="email" autocomplete="email"></div>
            <div class="mb-3"><label class="form-label" for="password">Mot de passe</label><input class="form-control" id="password" type="password" autocomplete="current-password"></div>
            <button class="btn btn-primary w-100" type="button" disabled>Connexion — API à relier</button>
          </form>
          <a class="d-inline-block mt-3" routerLink="/reinitialisation-mot-de-passe">Réinitialiser mon mot de passe</a>
        </div>
      </section>
    </main>
  `,
})
export class LoginPage {}
