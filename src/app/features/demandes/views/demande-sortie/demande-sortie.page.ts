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
function retourApresDepart(group: AbstractControl): ValidationErrors | null {
  const depart = group.get('heure_depart')?.value;
  const retour = group.get('heure_retour')?.value;
  const erreurs: ValidationErrors = {};
  if (depart && retour && retour <= depart) erreurs['retourAvantDepart'] = true;
  return Object.keys(erreurs).length ? erreurs : null;
}

/** Vérifie que la date de départ n'est pas dans le passé. */
function dateNonPassee(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return control.value < aujourdhui ? { datePassee: true } : null;
}

/** Recherche insensible à la casse et aux accents. */
const normaliser = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

interface Option { id: number; libelle: string; sigle?: string; code?: string; }

@Component({
  selector: 'app-demande-sortie',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './demande-sortie.page.html',
  styleUrls: ['./demande-sortie.page.scss', './demande-sortie.formulaire.scss'],
})
export class DemandeSortiePage implements OnInit {
  form: FormGroup;
  envoiEnCours = false;
  private demandeEnBrouillonId: number | null = null;
  soumis = false;
  modeFiche = false;
  messageSucces = '';
  messageErreur = '';

  readonly aujourdhui = new Date().toISOString().slice(0, 10);

  // Listes de référence.
  directions: Option[] = [];
  directionRecherche = '';
  directionsOuvertes = false;
  chargementDirections = false;
  directionActiveIndex = -1;
  services: Option[] = [];
  typesSortie: { id: number; label: string }[] = [];
  adresses: Option[] = [];
  entitesGeo: any[] = [];
  chargementServices = false;
  erreurChargementServices = '';


  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private demandeService: DemandeService,
    private router: Router
  ) {
    this.form = this.fb.group(
      {
        // Informations personnelles
        direction_id: [null as number | null, Validators.required],
        service_id: [null as number | null, Validators.required],
        nom: ['', [Validators.required, Validators.maxLength(255)]],
        prenom: ['', [Validators.required, Validators.maxLength(255)]],
        fonction: ['', [Validators.required, Validators.maxLength(255)]],
        motif: ['', Validators.required],
        nombre_employes: [
          1,
          [Validators.required, Validators.min(1), Validators.max(100), Validators.pattern(/^\d+$/)],
        ],

        // Sortie
        type_sortie_id: [null as number | null, Validators.required],
        date_depart: ['', [Validators.required, dateNonPassee]],
        heure_depart: ['', Validators.required],
        heure_retour: [''],
        adresse_depart_id: [null as number | null, Validators.required],
        adresse_depart: ['', Validators.required],

        destinations: this.fb.array([this.nouvelleDestination()]),
        objets: this.fb.array([]),
        commentaire: [''],
      },
      { validators: retourApresDepart }
    );

    // Changement de direction : on vide le service et on charge ceux de la nouvelle direction.
    this.form.get('direction_id')!.valueChanges.subscribe((id: number | null) => {
      this.viderService();
      this.services = [];
      this.chargementServices = false;
      this.erreurChargementServices = '';
      if (id) this.chargerServices(Number(id));
    });
  }

  ngOnInit(): void {
    this.chargementDirections = true;
    this.demandeService.chargerDirections().subscribe({
      next: (r) => {
        this.directions = r.data.map((direction) => ({
          id: direction.id,
          libelle: direction.nom,
          code: direction.code,
        }));
        this.chargementDirections = false;
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => {
        this.chargementDirections = false;
        this.afficherErreurChargement(e);
      },
    });

    this.demandeService.chargerTypesSortie().subscribe({
      next: (r) => {
        this.typesSortie = r.data.map((t: any) => ({ id: t.id, label: t.libelle }));
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => this.afficherErreurChargement(e),
    });

    this.demandeService.chargerEntitesGeographiques().subscribe({
      next: (r) => {
        this.entitesGeo = r.data;
        this.adresses = r.data.map((e: any) => ({ id: e.id, libelle: e.adresse }));
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => this.afficherErreurChargement(e),
    });
  }

  private afficherErreurChargement(
    erreur: HttpErrorResponse,
    ressource = 'les listes du formulaire'
  ): string {
    const messageApi = erreur.error?.message;
    const message = erreur.status === 401
      ? 'Session expirée ou connexion requise.'
      : erreur.status === 403
        ? `Accès refusé pour charger ${ressource}.`
        : erreur.status === 404
          ? `La route de l’API pour charger ${ressource} est introuvable.`
          : erreur.status === 0
            ? `Impossible de joindre l’API pour charger ${ressource}.`
            : messageApi || `Impossible de charger ${ressource} (HTTP ${erreur.status}).`;
    this.messageErreur = message;
    this.cdr.markForCheck();
    return message;
  }

  // ───────────── Services de la direction ─────────────
  private chargerServices(directionId: number): void {
    this.chargementServices = true;
    this.services = [];
    this.erreurChargementServices = '';
    this.demandeService.chargerServices(directionId).subscribe({
      next: (r) => {
        // Ignore une réponse arrivée après un changement de direction.
        if (this.form.get('direction_id')?.value != directionId) return;
        this.services = r.data
          .filter((service: any) => service.direction_id == null || Number(service.direction_id) === directionId)
          .map((x: any) => ({
          id: x.id,
          libelle: x.nom,
          sigle: x.sigle ?? x.code ?? '',
          }));
        this.chargementServices = false;
        this.erreurChargementServices = '';
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => {
        if (this.form.get('direction_id')?.value != directionId) return;
        this.chargementServices = false;
        this.erreurChargementServices = this.afficherErreurChargement(e, 'les services de cette direction');
      },
    });
  }

  private viderService(): void {
    this.form.get('service_id')!.reset(null);
  }

  get directionsFiltrees(): Option[] {
    const terme = normaliser(this.directionRecherche);
    return terme
      ? this.directions.filter((direction) => normaliser(`${direction.libelle} ${direction.code ?? ''}`).includes(terme))
      : this.directions;
  }

  get directionActiveId(): string | null {
    const direction = this.directionsFiltrees[this.directionActiveIndex];
    return direction ? `direction-option-${direction.id}` : null;
  }

  ouvrirListeDirections(input: HTMLInputElement): void {
    this.directionRecherche = '';
    this.directionsOuvertes = true;
    const idChoisi = this.form.get('direction_id')?.value as number | null;
    this.directionActiveIndex = this.directions.findIndex((direction) => direction.id === idChoisi);
    input.select();
  }

  rechercherDirection(event: Event): void {
    const valeur = (event.target as HTMLInputElement).value;
    this.directionRecherche = valeur;
    this.directionsOuvertes = true;
    this.directionActiveIndex = this.directionsFiltrees.length > 0 ? 0 : -1;

    const directionChoisie = this.form.get('direction_id')?.value as number | null;
    const libelleChoisi = this.libelleDirectionBrut(directionChoisie);
    if (directionChoisie && normaliser(valeur) !== normaliser(libelleChoisi)) {
      this.form.get('direction_id')!.setValue(null);
    }
  }

  choisirDirection(direction: Option): void {
    const controle = this.form.get('direction_id')!;
    controle.setValue(direction.id);
    controle.markAsTouched();
    this.directionRecherche = '';
    this.directionsOuvertes = false;
    this.directionActiveIndex = -1;
    this.cdr.markForCheck();
  }

  fermerListeDirections(): void {
    this.directionsOuvertes = false;
    this.directionActiveIndex = -1;
  }

  gererClavierDirections(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.fermerListeDirections();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.directionsOuvertes = true;
      if (this.directionsFiltrees.length === 0) return;
      const increment = event.key === 'ArrowDown' ? 1 : -1;
      const depart = this.directionActiveIndex < 0
        ? (increment > 0 ? -1 : this.directionsFiltrees.length)
        : this.directionActiveIndex;
      this.directionActiveIndex = (depart + increment + this.directionsFiltrees.length) % this.directionsFiltrees.length;
      return;
    }
    if (event.key === 'Enter' && this.directionsOuvertes) {
      const direction = this.directionsFiltrees[this.directionActiveIndex]
        ?? (this.directionsFiltrees.length === 1 ? this.directionsFiltrees[0] : null);
      if (direction) {
        event.preventDefault();
        this.choisirDirection(direction);
      }
    }
  }

  // ───────────── Listes dynamiques ─────────────
  get destinations(): FormArray {
    return this.form.get('destinations') as FormArray;
  }

  get objets(): FormArray {
    return this.form.get('objets') as FormArray;
  }

  private nouvelleDestination(): FormGroup {
    return this.fb.group({
      entite_geographique_id: [null as number | null, Validators.required],
      adresse: ['', Validators.required],
    });
  }

  private idAdresseCorrespondante(valeur: string): number | null {
    const recherche = normaliser(valeur);
    if (!recherche) return null;
    return this.adresses.find((adresse) => normaliser(adresse.libelle) === recherche)?.id ?? null;
  }

  libelleAdresseBrut(id: number | null): string {
    return this.adresses.find((adresse) => adresse.id == id)?.libelle ?? '';
  }

  saisirAdresseDepart(event: Event): void {
    const valeur = (event.target as HTMLInputElement).value;
    this.form.get('adresse_depart_id')!.setValue(this.idAdresseCorrespondante(valeur));
  }

  saisirDestination(event: Event, groupe: AbstractControl): void {
    const valeur = (event.target as HTMLInputElement).value;
    const id = this.idAdresseCorrespondante(valeur);
    groupe.get('entite_geographique_id')!.setValue(id);
  }

  libelleAdresseSaisie(id: number | null, adresse: string | null): string {
    return adresse?.trim() || this.libelleAdresseBrut(id) || 'Non renseignée';
  }

  libelleDestinationSaisie(groupe: AbstractControl): string {
    return this.libelleAdresseSaisie(
      groupe.get('entite_geographique_id')?.value,
      groupe.get('adresse')?.value,
    );
  }

  private nouvelObjet(): FormGroup {
    return this.fb.group({
      designation: ['', [Validators.required, Validators.maxLength(255)]],
      quantite: [1, [Validators.min(1), Validators.pattern(/^\d+$/)]],
      description: [''],
    });
  }

  ajouterDestination(): void {
    this.destinations.push(this.nouvelleDestination());
  }

  supprimerDestination(i: number): void {
    if (this.destinations.length > 1) this.destinations.removeAt(i);
  }

  /** Déplace une étape vers le haut (-1) ou vers le bas (+1). */
  deplacerDestination(i: number, sens: -1 | 1): void {
    const j = i + sens;
    if (j < 0 || j >= this.destinations.length) return;
    const ctrl = this.destinations.at(i);
    this.destinations.removeAt(i);
    this.destinations.insert(j, ctrl);
  }

  ajouterObjet(): void {
    this.objets.push(this.nouvelObjet());
  }

  supprimerObjet(i: number): void {
    this.objets.removeAt(i);
  }

  // ───────────── Validation ─────────────
  invalide(nom: string): boolean {
    const c = this.form.get(nom);
    return !!c && c.invalid && (c.touched || c.dirty || this.soumis);
  }

  invalideItem(groupe: AbstractControl, nom: string): boolean {
    const c = groupe.get(nom);
    return !!c && c.invalid && (c.touched || c.dirty || this.soumis);
  }

  // ───────────── Libellés ─────────────
  libelleEntiteGeo(e: any): string {
    return e?.adresse ?? e?.libelle ?? e?.nom ?? String(e?.id ?? '');
  }

  libelleDirectionBrut(id: number | null): string {
    return this.directions.find(d => d.id == id)?.libelle ?? '';
  }

  libelleDirection(id: number | null): string {
    return this.libelleDirectionBrut(id) || 'Non renseignée';
  }

  libelleService(id: number | null): string {
    const sv = this.services.find(x => x.id == id);
    if (!sv) return 'Non renseigné';
    return sv.sigle ? `${sv.sigle} — ${sv.libelle}` : sv.libelle;
  }

  libelleTypeSortie(id: number | null): string {
    return this.typesSortie.find(t => t.id == id)?.label ?? 'Non renseigné';
  }

  libelleDestination(id: number | null): string {
    const entite = this.entitesGeo.find(e => e.id == id);
    return entite ? this.libelleEntiteGeo(entite) : 'Non renseignée';
  }

  // ───────────── Fiche détaillée ─────────────
  afficherFiche(): void {
    this.soumis = true;
    this.messageErreur = '';
    this.messageSucces = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageErreur = 'Veuillez corriger les champs obligatoires avant de continuer.';
      return;
    }
    this.modeFiche = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  modifierDemande(): void {
    this.modeFiche = false;
    this.messageErreur = '';
  }

  validerDemande(): void {
    this.soumettre();
  }

  // ───────────── Envoi à l'API ─────────────
  private construirePayload(): DemandePayload {
    const v = this.form.getRawValue();
    const avecSecondes = (h: string) => (h && h.length === 5 ? `${h}:00` : h);

    return {
      direction_id: v.direction_id,
      service_id: v.service_id,
      employes: [{
        nom: v.nom.trim(),
        prenom: v.prenom.trim(),
        fonction: v.fonction.trim(),
      }],
      motif: v.motif,
      type_sortie_id: v.type_sortie_id,
      adresse_depart_id: v.adresse_depart_id,
      date_depart: v.date_depart,
      heure_depart: avecSecondes(v.heure_depart),

      destinations: v.destinations.map((d: any, i: number) => ({
        entite_geographique_id: d.entite_geographique_id,
        ordre: i + 1,
      })),

      heure_retour: avecSecondes(v.heure_retour),

      commentaire: v.commentaire || null,
      objets: v.objets,
    };
  }

  soumettre(): void {
    if (this.envoiEnCours) return;

    // Évite de créer un doublon si la création a réussi mais pas la soumission.
    if (this.demandeEnBrouillonId !== null) {
      this.soumettreBrouillon(this.demandeEnBrouillonId);
      return;
    }

    this.soumis = true;
    this.messageSucces = '';
    this.messageErreur = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageErreur = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.envoiEnCours = true;

    this.demandeService.creer(this.construirePayload()).subscribe({
      next: (reponse) => {
        const id = reponse?.data?.id;
        if (!Number.isInteger(id) || id < 1) {
          this.envoiEnCours = false;
          this.messageErreur = 'L’API a créé une réponse invalide. Vérifiez l’historique avant de réessayer.';
          this.cdr.markForCheck();
          return;
        }
        this.demandeEnBrouillonId = id;
        this.soumettreBrouillon(id);
      },
      error: (erreur: HttpErrorResponse) => {
        this.envoiEnCours = false;

        if (erreur.status === 422 && erreur.error?.errors) {
          this.messageErreur = (Object.values(erreur.error.errors) as string[][]).flat().join(' ');
        } else if (erreur.status === 401) {
          this.messageErreur = 'Session expirée ou connexion requise.';
        } else if (erreur.status === 403) {
          this.messageErreur = 'Vous ne possédez pas la permission de créer une demande.';
        } else if (erreur.status === 0 && erreur.error?.name === 'TimeoutError') {
          this.messageErreur =
            'L’API n’a pas répondu dans le délai prévu. Vérifiez l’historique avant de réessayer.';
        } else if (erreur.status === 0) {
          this.messageErreur = 'Impossible de joindre l’API. Vérifiez que le serveur est démarré puis réessayez.';
        } else {
          this.messageErreur = erreur.error?.message || 'Erreur lors de l’envoi de la demande.';
        }
        this.cdr.markForCheck();
      },
      complete: () => {
        if (this.demandeEnBrouillonId === null) this.envoiEnCours = false;
        this.cdr.markForCheck();
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
        this.messageSucces = reponse?.message || 'Demande soumise avec succès.';
        this.cdr.markForCheck();
        void this.router.navigate(['/dashboard/demandes/historique']);
      },
      error: (erreur: HttpErrorResponse) => {
        this.envoiEnCours = false;
        if (erreur.status === 401) {
          this.messageErreur = 'Session expirée ou connexion requise.';
        } else if (erreur.status === 403) {
          this.messageErreur =
            'La demande est enregistrée en brouillon, mais votre compte ne possède pas la permission de la soumettre.';
        } else if (erreur.status === 0 && erreur.error?.name === 'TimeoutError') {
          this.messageErreur =
            'La soumission dépasse le délai prévu. La demande reste en brouillon : cliquez de nouveau pour réessayer.';
        } else if (erreur.status === 0) {
          this.messageErreur =
            'Impossible de joindre l’API. La demande reste en brouillon : vérifiez le serveur puis réessayez.';
        } else {
          this.messageErreur =
            erreur.error?.message ||
            'La demande est enregistrée en brouillon, mais sa soumission a échoué. Réessayez.';
        }
        this.cdr.markForCheck();
      },
    });
  }

  // ───────────── Réinitialisation ─────────────
  private reinitialiser(): void {
    this.demandeEnBrouillonId = null;
    this.directionRecherche = '';
    this.directionsOuvertes = false;
    this.directionActiveIndex = -1;
    this.form.reset({
      direction_id: null,
      service_id: null,
      nom: '',
      prenom: '',
      fonction: '',
      motif: '',
      nombre_employes: 1,
      type_sortie_id: null,
      date_depart: '',
      heure_depart: '',
      heure_retour: '',
      adresse_depart_id: null,
      adresse_depart: '',
      commentaire: '',
    });
    this.services = [];
    this.destinations.clear();
    this.destinations.push(this.nouvelleDestination());
    this.objets.clear();
    this.soumis = false;
  }

  annuler(): void {
    this.reinitialiser();
    this.messageErreur = '';
  }

  nouvelleDemande(): void {
    this.reinitialiser();
    this.modeFiche = false;
    this.messageSucces = '';
    this.messageErreur = '';
  }

  ouvrirHistorique(): void {
    void this.router.navigate(['/dashboard/demandes/historique']);
  }
}
