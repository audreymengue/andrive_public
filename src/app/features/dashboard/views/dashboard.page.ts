import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CoreService } from '@/core/services/core.service';
import { AuthService } from '@/core/services/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: '../dashboard.page.html',
})
export class DashboardPage {
  protected readonly coreService = inject(CoreService);
  private readonly authService = inject(AuthService);

  protected readonly afficherRenouvellement = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal('');
  protected readonly succes = signal('');

  protected readonly formulaire = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    confirmationPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  renouvelerMotDePasse(): void {
    this.erreur.set('');
    this.succes.set('');
    this.formulaire.reset();
    this.afficherRenouvellement.set(true);
  }

  fermerRenouvellement(): void {
    if (this.enCours()) return;

    this.afficherRenouvellement.set(false);
    this.erreur.set('');
    this.formulaire.reset();
  }

  enregistrerNouveauMotDePasse(): void {
    this.erreur.set('');
    this.succes.set('');

    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      this.erreur.set('Veuillez remplir les trois champs.');
      return;
    }

    const {
      currentPassword,
      newPassword,
      confirmationPassword,
    } = this.formulaire.getRawValue();

    if (newPassword !== confirmationPassword) {
      this.erreur.set('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    if (currentPassword === newPassword) {
      this.erreur.set('Le nouveau mot de passe doit être différent de l’ancien.');
      return;
    }

    this.enCours.set(true);

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.enCours.set(false);
        this.afficherRenouvellement.set(false);
        this.formulaire.reset();
        this.succes.set('Votre mot de passe a été renouvelé avec succès.');
      },
      error: (err: unknown) => {
        this.enCours.set(false);

        if (err instanceof HttpErrorResponse) {
          const message = err.error?.message;

          this.erreur.set(
            typeof message === 'string'
              ? message
              : 'Impossible de renouveler le mot de passe. Vérifiez votre mot de passe actuel et réessayez.',
          );
        } else {
          this.erreur.set('Une erreur inattendue est survenue.');
        }
      },
    });
  }
}