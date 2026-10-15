import { HttpErrorResponse } from '@angular/common/http';
import { DemandePayload, DemandeService } from '../../services/demande.service';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

/** Vérifie que l'heure de retour est après celle du départ. */
function retourApresDepart(
  group: AbstractControl
): ValidationErrors | null {
  const depart = group.get('heure_depart')?.value;
  const retour = group.get('heure_retour')?.value;

  if (depart && retour && retour <= depart) {
    return { retourAvantDepart: true };
  }

  return null;
}

@Component({
  selector: 'app-demande-sortie',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './demande-sortie.page.html',
  styleUrl: './demande-sortie.page.scss',
})
export class DemandeSortiePage implements OnInit  {
  form: FormGroup;
  envoiEnCours = false;
  private demandeEnBrouillonId: number | null = null;
  soumis = false;
  modeFiche = false;
  messageSucces = '';
messageErreur = '';
  ngOnInit(): void {
    this.demandeService.chargerDirections().subscribe({
      next: (resultat) => {
        this.directions = resultat.data.map(d => ({
          id: d.id,
          libelle: d.nom,
        }));
        this.cdr.markForCheck();
      },
      error: (erreur: HttpErrorResponse) => this.afficherErreurChargement(erreur),
    });

    this.demandeService.chargerTypesSortie().subscribe({
      next: (resultat) => {
        this.typesSortie = resultat.data.map(t => ({
          id: t.id,
          label: t.libelle,
        }));
        this.cdr.markForCheck();
      },
      error: (erreur: HttpErrorResponse) => this.afficherErreurChargement(erreur),
    });

    this.demandeService.chargerEntitesGeographiques().subscribe({
      next: (resultat) => {
        this.entitesGeo = resultat.data;

        this.adresses = resultat.data.map(e => ({
          id: e.id,
          libelle: e.adresse,
        }));
        this.cdr.markForCheck();
      },
      error: (erreur: HttpErrorResponse) => this.afficherErreurChargement(erreur),
    });
  }

  private afficherErreurChargement(erreur: HttpErrorResponse): void {
    this.messageErreur =
      erreur.status === 401
        ? 'Session expirée ou connexion requise.'
        : 'Impossible de charger une ou plusieurs listes du formulaire.';
    this.cdr.markForCheck();
  }

  // Données à alimenter depuis les services existants.
  directions: { id: number; libelle: string }[] = [];
  typesSortie: { id: number; label: string }[] = [];
  adresses: { id: number; libelle: string }[] = [];
  entitesGeo: any[] = [];

  constructor(private fb: FormBuilder,
  private cdr: ChangeDetectorRef,
  private demandeService: DemandeService,
  private router: Router) {
    this.form = this.fb.group(
      {
        direction_id: [
          null as number | null,
          Validators.required,
        ],

        type_sortie_id: [
          null as number | null,
          Validators.required,
        ],

        motif: [
          '',
          Validators.required,
        ],

        commentaire: [''],

        date_depart: ['', Validators.required],
        heure_depart: ['', Validators.required],

        // Facultatifs selon la maquette.
        heure_retour: [''],

        adresse_depart_id: [
          null as number | null,
          Validators.required,
        ],

        adresse_retour_id: [
          null as number | null,
        ],

        destinations: this.fb.array([
          this.nouvelleDestination(),
        ]),

        employes: this.fb.array([
          this.nouvelEmploye(),
        ]),

        objets: this.fb.array([]),
      },
      {
        validators: retourApresDepart,
      }
    );
  }

  // Accès aux listes dynamiques.
  get destinations(): FormArray {
    return this.form.get('destinations') as FormArray;
  }

  get employes(): FormArray {
    return this.form.get('employes') as FormArray;
  }

  get objets(): FormArray {
    return this.form.get('objets') as FormArray;
  }

  // Création d'une destination.
  private nouvelleDestination(): FormGroup {
    return this.fb.group({
      entite_geographique_id: [
        null as number | null,
        Validators.required,
      ],
    });
  }

  // Création d'un employé.
  private nouvelEmploye(): FormGroup {
    return this.fb.group({
      nom: ['', [Validators.required, Validators.maxLength(255)]],
      prenom: ['', [Validators.required, Validators.maxLength(255)]],
      fonction: ['', Validators.maxLength(255)],
    });
  }

  // Création d'un objet transporté.
  private nouvelObjet(): FormGroup {
    return this.fb.group({
      designation: ['', [Validators.required, Validators.maxLength(255)]],
      quantite: [
        1,
        [Validators.min(1), Validators.pattern(/^\d+$/)],
      ],
      description: [''],
    });
  }

  // Ajouter ou supprimer une destination.
  ajouterDestination(): void {
    this.destinations.push(this.nouvelleDestination());
  }

  supprimerDestination(i: number): void {
    if (this.destinations.length > 1) {
      this.destinations.removeAt(i);
    }
  }

  // Ajouter ou supprimer un employé.
  ajouterEmploye(): void {
    this.employes.push(this.nouvelEmploye());
  }

  supprimerEmploye(i: number): void {
    if (this.employes.length > 1) {
      this.employes.removeAt(i);
    }
  }

  // Ajouter ou supprimer un objet.
  ajouterObjet(): void {
    this.objets.push(this.nouvelObjet());
  }

  supprimerObjet(i: number): void {
    this.objets.removeAt(i);
  }

  // Détecter les erreurs des champs principaux.
  invalide(nom: string): boolean {
    const c = this.form.get(nom);

    return !!c &&
      c.invalid &&
      (c.touched || c.dirty || this.soumis);
  }

  // Détecter les erreurs dans les listes dynamiques.
  invalideItem(
    groupe: AbstractControl,
    nom: string
  ): boolean {
    const c = groupe.get(nom);

    return !!c &&
      c.invalid &&
      (c.touched || c.dirty || this.soumis);
  }

  // Récupérer le libellé d'une entité géographique.
  libelleEntiteGeo(e: any): string {
    return e?.adresse ??
      e?.libelle ??
      e?.nom ??
      String(e?.id ?? '');
  }
  // Afficher les libellés plutôt que les identifiants.
libelleDirection(id: number | null): string {
  return this.directions.find(d => d.id == id)?.libelle
    ?? 'Non renseignée';
}

libelleTypeSortie(id: number | null): string {
  return this.typesSortie.find(t => t.id == id)?.label
    ?? 'Non renseigné';
}

libelleAdresse(id: number | null): string {
  return this.adresses.find(a => a.id == id)?.libelle
    ?? 'Non renseignée';
}

libelleDestination(id: number | null): string {
  const entite = this.entitesGeo.find(e => e.id == id);
  return entite
    ? this.libelleEntiteGeo(entite)
    : 'Non renseignée';
}

// Passer du formulaire à la fiche détaillée.
afficherFiche(): void {
  this.soumis = true;
  this.messageErreur = '';
  this.messageSucces = '';

  if (this.form.invalid) {
    this.form.markAllAsTouched();
    this.messageErreur =
      'Veuillez corriger les champs obligatoires avant de continuer.';
    return;
  }

  this.modeFiche = true;
}

// Revenir au formulaire sans perdre les données.
modifierDemande(): void {
  this.modeFiche = false;
  this.messageErreur = '';
}

// Valider définitivement en envoyant à l'API.
validerDemande(): void {
  this.soumettre();
}

  // Préparer les données attendues par l'API.
  private construirePayload(): DemandePayload {
    const v = this.form.getRawValue();

    const avecSecondes = (h: string) =>
      h && h.length === 5 ? `${h}:00` : h;

    return {
      direction_id: v.direction_id,
      type_sortie_id: v.type_sortie_id,
      adresse_depart_id: v.adresse_depart_id,

      date_depart: v.date_depart,
      heure_depart: avecSecondes(v.heure_depart),
      motif: v.motif,

      destinations: v.destinations.map(
        (d: any, i: number) => ({
          entite_geographique_id:
            d.entite_geographique_id,
          ordre: i + 1,
        })
      ),

      employes: v.employes,

      adresse_retour_id: v.adresse_retour_id ?? null,
      heure_retour: avecSecondes(v.heure_retour),

      commentaire: v.commentaire || null,
      objets: v.objets,
    };
  }

  // Soumettre le formulaire.
  soumettre(): void {
    if (this.envoiEnCours) return;

    // Si la création a réussi mais pas la soumission, réessayer la soumission
    // sur le brouillon existant au lieu de créer une demande en doublon.
    if (this.demandeEnBrouillonId !== null) {
      this.soumettreBrouillon(this.demandeEnBrouillonId);
      return;
    }

  this.soumis = true;
  this.messageSucces = '';
  this.messageErreur = '';

  if (this.form.invalid) {
    this.form.markAllAsTouched();
    this.messageErreur =
      'Veuillez corriger les champs obligatoires.';
    return;
  }
  
  this.envoiEnCours = true;
  const payload = this.construirePayload();

  this.demandeService.creer(payload).subscribe({
    next: (reponse) => {
      this.demandeEnBrouillonId = reponse.data.id;
      this.soumettreBrouillon(reponse.data.id);
    },
    error: (erreur: HttpErrorResponse) => {
      this.envoiEnCours = false;

      if (erreur.status === 422 && erreur.error?.errors) {
        const erreurs = Object.values(
          erreur.error.errors as Record<string, string[]>
        ).flat();

        this.messageErreur = erreurs.join(' ');
      } else if (erreur.status === 401) {
        this.messageErreur =
          'Session expirée ou connexion requise.';
      } else if (erreur.status === 403) {
        this.messageErreur =
          'Vous ne possédez pas la permission de créer une demande.';
      } else {
        this.messageErreur =
          erreur.error?.message ||
          'Erreur lors de l’envoi de la demande.';
      }
    },
  });
}

  private soumettreBrouillon(id: number): void {
    this.envoiEnCours = true;
    this.messageErreur = '';

    this.demandeService.soumettre(id).subscribe({
      next: (reponse) => {
        this.envoiEnCours = false;
        this.demandeEnBrouillonId = null;
        this.messageSucces = reponse.message || 'Demande soumise avec succès.';
        void this.router.navigate(['/dashboard/demandes/historique']);
      },
      error: (erreur: HttpErrorResponse) => {
        this.envoiEnCours = false;
        if (erreur.status === 401) {
          this.messageErreur = 'Session expirée ou connexion requise.';
        } else if (erreur.status === 403) {
          this.messageErreur =
            'La demande est enregistrée en brouillon, mais votre compte ne possède pas la permission de la soumettre.';
        } else {
          this.messageErreur =
            erreur.error?.message ||
            'La demande est enregistrée en brouillon, mais sa soumission a échoué. Réessayez.';
        }
      },
    });
  }

  // Réinitialiser le formulaire.
  annuler(): void {
    this.form.reset();
    this.soumis = false;
  }

  ouvrirHistorique(): void {
    void this.router.navigate(['/dashboard/demandes/historique']);
  }

  nouvelleDemande(): void {
    this.demandeEnBrouillonId = null;
    this.form.reset({
      direction_id: null,
      type_sortie_id: null,
      motif: '',
      commentaire: '',
      date_depart: '',
      heure_depart: '',
      heure_retour: '',
      adresse_depart_id: null,
      adresse_retour_id: null,
    });
    this.destinations.clear();
    this.destinations.push(this.nouvelleDestination());
    this.employes.clear();
    this.employes.push(this.nouvelEmploye());
    this.objets.clear();
    this.modeFiche = false;
    this.soumis = false;
    this.messageSucces = '';
    this.messageErreur = '';
  }
}
