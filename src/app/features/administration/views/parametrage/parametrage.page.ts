import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import {
  DirectionParametre,
  EntiteGeographiqueParametre,
  ParametrageService,
  ServiceParametre,
  StatutReference,
  TypeSortieParametre,
  VehiculeParametre,
} from '../../services/parametrage.service';
import { UserService } from '../../services/user.service';
import { isEligibleChauffeurAccount, User } from '../../models/user.model';

type SectionKey = 'directions' | 'services' | 'types-sortie' | 'lieux' | 'chauffeurs' | 'vehicules';
type ReferenceRecord = DirectionParametre | ServiceParametre | TypeSortieParametre | EntiteGeographiqueParametre | VehiculeParametre | User;
type EditorMode = 'create' | 'edit' | 'status' | 'delete';

interface EditorState {
  mode: EditorMode;
  item?: ReferenceRecord;
  targetStatus?: StatutReference;
}

interface SectionInfo {
  key: SectionKey;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-parametrage-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './parametrage.page.html',
  styleUrl: './parametrage.page.scss',
})
export class ParametragePage {
  private readonly api = inject(ParametrageService);
  private readonly usersApi = inject(UserService);

  protected readonly sections: SectionInfo[] = [
    { key: 'directions', title: 'Direction', icon: 'bi bi-building' },
    { key: 'services', title: 'Service', icon: 'bi bi-diagram-3' },
    { key: 'types-sortie', title: 'Type de sortie', icon: 'bi bi-list-check' },
    { key: 'lieux', title: 'Lieu géographique', icon: 'bi bi-geo-alt' },
    { key: 'chauffeurs', title: 'Chauffeurs', icon: 'bi bi-person-badge' },
    { key: 'vehicules', title: 'Parc automobile', icon: 'bi bi-car-front' },
  ];

  protected readonly selectedSection = signal<SectionKey | null>(null);
  protected readonly records = signal<ReferenceRecord[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly directions = signal<DirectionParametre[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editor = signal<EditorState | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly temporaryPassword = signal('');
  protected searchText = '';

  protected draft = {
    direction_id: null as number | null,
    nom: '',
    code: '',
    description: '',
    libelle: '',
    adresse: '',
    latitude: null as number | null,
    longitude: null as number | null,
    motif: '',
    prenom: '',
    email: '',
    immatriculation: '',
    places_utiles: null as number | null,
    statut: 'ACTIF' as StatutReference,
    current_password: '',
  };

  protected sectionInfo(): SectionInfo | undefined {
    return this.sections.find((section) => section.key === this.selectedSection());
  }

  protected openSection(section: SectionKey): void {
    this.selectedSection.set(section);
    this.currentPage.set(1);
    this.lastPage.set(1);
    this.searchText = '';
    this.errorMessage.set('');
    this.successMessage.set('');
    this.temporaryPassword.set('');
    this.loadRecords();
    if (section === 'chauffeurs') this.loadDirections();
  }

  protected backToSections(): void {
    if (this.saving()) return;
    this.selectedSection.set(null);
    this.editor.set(null);
    this.errorMessage.set('');
  }

  protected reload(): void {
    this.loadRecords();
  }

  protected search(): void {
    this.currentPage.set(1);
    this.loadRecords();
  }

  protected changePage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadRecords();
  }

  protected openCreate(): void {
    const section = this.selectedSection();
    if (!section) return;
    this.resetDraft();
    this.errorMessage.set('');
    this.editor.set({ mode: 'create' });
    if (section === 'services' || section === 'chauffeurs') this.loadDirections();
  }

  protected openEdit(item: ReferenceRecord): void {
    this.resetDraft();
    this.errorMessage.set('');
    if (this.isDirection(item)) {
      this.draft.nom = item.nom;
      this.draft.description = item.description ?? '';
    } else if (this.isService(item)) {
      this.draft.nom = item.nom;
      this.draft.description = item.description ?? '';
    } else if (this.isType(item)) {
      this.draft.libelle = item.libelle;
      this.draft.code = item.code;
    } else if (this.isLieu(item)) {
      this.draft.adresse = item.adresse;
      this.draft.latitude = item.latitude === null ? null : Number(item.latitude);
      this.draft.longitude = item.longitude === null ? null : Number(item.longitude);
      this.draft.description = item.description ?? '';
    }
    this.editor.set({ mode: 'edit', item });
    if (this.isService(item)) this.loadDirections();
  }

  protected openStatus(item: ReferenceRecord, status: StatutReference): void {
    if (!this.isDirection(item) && !this.isService(item)) return;
    this.resetDraft();
    this.errorMessage.set('');
    this.editor.set({ mode: 'status', item, targetStatus: status });
  }

  protected openDelete(item: ReferenceRecord): void {
    if (!this.isType(item) && !this.isLieu(item) && !this.isVehicule(item) && !this.isUser(item)) return;
    this.errorMessage.set('');
    this.editor.set({ mode: 'delete', item });
  }

  protected closeEditor(): void {
    if (this.saving()) return;
    this.editor.set(null);
    this.errorMessage.set('');
  }

  protected submitEditor(): void {
    const state = this.editor();
    const section = this.selectedSection();
    if (!state || !section || this.saving()) return;
    this.errorMessage.set('');

    if (state.mode === 'status') {
      if (!this.draft.motif.trim()) {
        this.errorMessage.set('Le motif de cette action est obligatoire.');
        return;
      }
      const item = state.item;
      if (!item || (!this.isDirection(item) && !this.isService(item))) return;
      const change = this.isDirection(item)
        ? this.api.changeDirectionStatus(item.id, state.targetStatus!, item.lock_version, this.draft.motif.trim())
        : this.api.changeServiceStatus((item as ServiceParametre).id, state.targetStatus!, (item as ServiceParametre).lock_version, this.draft.motif.trim());
      this.runMutation(change, state.targetStatus === 'ACTIF' ? 'Élément activé.' : 'Élément désactivé.');
      return;
    }

    if (state.mode === 'delete') {
      const item = state.item;
      if (!item) return;
      const deletion: Observable<unknown> | null = this.isType(item)
        ? this.api.deleteTypeSortie(item.id)
        : this.isLieu(item)
          ? this.api.deleteLieu(item.id)
          : this.isVehicule(item)
            ? this.api.deleteVehicule(item.id, item.lock_version)
            : this.isUser(item)
              ? this.usersApi.deactivate(item.id, { version: item.lock_version ?? 0, motif: 'Retrait du chauffeur du service' })
              : null;
      if (deletion) this.runMutation(deletion, this.isUser(item) ? 'Compte chauffeur désactivé.' : this.isVehicule(item) ? 'Véhicule retiré du parc.' : 'Élément supprimé.');
      return;
    }

    if (section === 'chauffeurs') {
      this.saveChauffeur();
      return;
    }

    if (section === 'vehicules') {
      if (!this.draft.immatriculation.trim() || this.draft.places_utiles === null || this.draft.places_utiles < 1) {
        this.errorMessage.set('L’immatriculation et le nombre de places utiles (au moins 1) sont obligatoires.');
        return;
      }
      this.runMutation(this.api.createVehicule({
        immatriculation: this.draft.immatriculation.trim().toUpperCase(),
        places_utiles: this.draft.places_utiles,
      }), 'Véhicule ajouté.');
      return;
    }

    if (section === 'directions') {
      if (state.mode === 'create') {
        if (!this.draft.nom.trim() || !this.draft.code.trim()) {
          this.errorMessage.set('Le nom et le code de la direction sont obligatoires.');
          return;
        }
        this.runMutation(this.api.createDirection({
          nom: this.draft.nom.trim(),
          code: this.draft.code.trim(),
          description: this.draft.description.trim() || null,
        }), 'Direction ajoutée.');
        return;
      }

      const item = state.item;
      if (!this.isDirection(item) || !this.draft.nom.trim()) {
        this.errorMessage.set('Le nom de la direction est obligatoire.');
        return;
      }
      this.runMutation(this.api.updateDirection(item.id, {
        nom: this.draft.nom.trim(),
        description: this.draft.description.trim() || null,
        version_attendue: item.lock_version,
        ...(this.draft.motif.trim() ? { motif: this.draft.motif.trim() } : {}),
      }), 'Direction modifiée.');
      return;
    }

    if (section === 'services') {
      if (!this.draft.nom.trim()) {
        this.errorMessage.set('Le nom du service est obligatoire.');
        return;
      }
      if (state.mode === 'create') {
        if (!this.draft.direction_id || !this.draft.code.trim()) {
          this.errorMessage.set('La direction et le code sont obligatoires.');
          return;
        }
        this.runMutation(this.api.createService({
          direction_id: this.draft.direction_id,
          nom: this.draft.nom.trim(),
          code: this.draft.code.trim(),
          description: this.draft.description.trim() || null,
        }), 'Service ajouté.');
      } else {
        const item = state.item;
        if (!this.isService(item)) return;
        this.runMutation(this.api.updateService(item.id, {
          nom: this.draft.nom.trim(),
          description: this.draft.description.trim() || null,
          version_attendue: item.lock_version,
          ...(this.draft.motif.trim() ? { motif: this.draft.motif.trim() } : {}),
        }), 'Service modifié.');
      }
      return;
    }

    if (section === 'types-sortie') {
      if (!this.draft.libelle.trim() || !this.draft.code.trim()) {
        this.errorMessage.set('Le libellé et le code sont obligatoires.');
        return;
      }
      const payload = { libelle: this.draft.libelle.trim(), code: this.draft.code.trim() };
      const mutation = state.mode === 'create'
        ? this.api.createTypeSortie(payload)
        : this.api.updateTypeSortie(state.item!.id, payload);
      this.runMutation(mutation, state.mode === 'create' ? 'Type de sortie ajouté.' : 'Type de sortie modifié.');
      return;
    }

    if (!this.draft.adresse.trim()) {
      this.errorMessage.set('L’adresse est obligatoire.');
      return;
    }
    const payload = {
      adresse: this.draft.adresse.trim(),
      latitude: this.parseCoordinate(this.draft.latitude),
      longitude: this.parseCoordinate(this.draft.longitude),
      description: this.draft.description.trim() || null,
    };
    const mutation = state.mode === 'create'
      ? this.api.createLieu(payload)
      : this.api.updateLieu(state.item!.id, payload);
    this.runMutation(mutation, state.mode === 'create' ? 'Lieu ajouté.' : 'Lieu modifié.');
  }

  protected nameOf(item: ReferenceRecord): string {
    if (this.isUser(item)) return `${item.prenom} ${item.nom}`.trim();
    if (this.isVehicule(item)) return item.immatriculation;
    if (this.isType(item)) return item.libelle;
    if (this.isLieu(item)) return item.adresse;
    return item.nom;
  }

  protected codeOf(item: ReferenceRecord): string {
    if (this.isVehicule(item)) return `${item.places_utiles} place(s) utile(s)`;
    if (this.isUser(item)) return item.email;
    return 'code' in item ? item.code : '—';
  }

  protected descriptionOf(item: ReferenceRecord): string {
    return 'description' in item ? item.description ?? '' : '';
  }

  protected latitudeOf(item: ReferenceRecord): string | number {
    return this.isLieu(item) && item.latitude !== null ? item.latitude : '—';
  }

  protected longitudeOf(item: ReferenceRecord): string | number {
    return this.isLieu(item) && item.longitude !== null ? item.longitude : '—';
  }

  protected statusOf(item: ReferenceRecord): StatutReference | null {
    return 'statut' in item ? item.statut : null;
  }

  protected isVehicule(item: ReferenceRecord | undefined): item is VehiculeParametre {
    return !!item && 'immatriculation' in item;
  }

  protected isUser(item: ReferenceRecord | undefined): item is User {
    return !!item && 'email' in item && 'roles' in item;
  }

  protected directionOf(item: ReferenceRecord): string {
    if (this.isService(item)) {
      if (typeof item.direction === 'string') return item.direction;
      const directionNom = item.direction?.nom ?? item.direction?.name ?? item.direction_nom;
      if (directionNom) return directionNom;
    }

    const rawId = this.isUser(item) || this.isService(item) ? item.direction_id : null;
    const directionId = Number(rawId);
    if (!Number.isInteger(directionId) || directionId <= 0) return 'Direction non renseignée';

    return this.directions().find((direction) => Number(direction.id) === directionId)?.nom
      ?? `Direction #${directionId}`;
  }

  protected isDirection(item: ReferenceRecord | undefined): item is DirectionParametre {
    return !!item && 'lock_version' in item && 'code' in item && !('direction_id' in item);
  }

  protected isService(item: ReferenceRecord | undefined): item is ServiceParametre {
    return !!item && 'direction_id' in item && 'code' in item && !('roles' in item);
  }

  protected isType(item: ReferenceRecord | undefined): item is TypeSortieParametre {
    return !!item && 'libelle' in item;
  }

  protected isLieu(item: ReferenceRecord | undefined): item is EntiteGeographiqueParametre {
    return !!item && 'adresse' in item;
  }

  protected currentTitle(): string {
    return this.sectionInfo()?.title ?? 'Paramétrage';
  }

  protected createAllowed(): boolean {
    return this.selectedSection() !== null;
  }

  protected emptyMessage(): string {
    if (this.selectedSection() === 'directions') return 'Aucune direction trouvée.';
    if (this.selectedSection() === 'services') return 'Aucun service trouvé.';
    if (this.selectedSection() === 'types-sortie') return 'Aucun type de sortie trouvé.';
    if (this.selectedSection() === 'lieux') return 'Aucun lieu trouvé.';
    if (this.selectedSection() === 'chauffeurs') return 'Aucun chauffeur trouvé.';
    return 'Aucun véhicule trouvé.';
  }

  protected editorTitle(): string {
    const state = this.editor();
    if (!state) return '';
    if (state.mode === 'status') return state.targetStatus === 'ACTIF' ? 'Activer cet élément' : 'Désactiver cet élément';
    if (state.mode === 'delete') return 'Supprimer cet élément';
    if (state.mode === 'create') return this.selectedSection() === 'directions' ? 'Ajouter une direction' : this.selectedSection() === 'services' ? 'Ajouter un service' : this.selectedSection() === 'types-sortie' ? 'Ajouter un type de sortie' : this.selectedSection() === 'chauffeurs' ? 'Créer un compte chauffeur' : this.selectedSection() === 'vehicules' ? 'Ajouter un véhicule' : 'Ajouter un lieu';
    return this.selectedSection() === 'directions' ? 'Modifier la direction' : this.selectedSection() === 'services' ? 'Modifier le service' : this.selectedSection() === 'types-sortie' ? 'Modifier le type de sortie' : 'Modifier le lieu';
  }

  private resetDraft(): void {
    this.draft = { direction_id: null, nom: '', code: '', description: '', libelle: '', adresse: '', latitude: null, longitude: null, motif: '', prenom: '', email: '', immatriculation: '', places_utiles: null, statut: 'ACTIF', current_password: '' };
  }

  private loadRecords(): void {
    const section = this.selectedSection();
    if (!section) return;
    if (section === 'services') {
      this.loadServices();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    const request: Observable<ReferenceRecord[]> = section === 'directions'
      ? this.api.listDirections(this.searchText, this.currentPage()).pipe(map((response) => {
          this.lastPage.set(response.meta?.last_page ?? 1);
          return response.data;
        }))
      : section === 'types-sortie'
          ? this.api.listTypesSortie().pipe(map((response) => {
              this.currentPage.set(1);
              this.lastPage.set(1);
              return response.data;
            }))
          : section === 'lieux' ? this.api.listLieux().pipe(map((response) => {
              this.currentPage.set(1);
              this.lastPage.set(1);
              return response.data;
            }))
            : section === 'chauffeurs' ? this.usersApi.list({ search: this.searchText, page: this.currentPage(), perPage: 100, role: 'chauffeur' }).pipe(map((response) => {
              this.lastPage.set(response.meta.last_page);
              return response.data.filter(isEligibleChauffeurAccount);
            }))
              : this.api.listVehicules(this.searchText, this.currentPage()).pipe(map((response) => {
                this.lastPage.set(response.meta?.last_page ?? 1);
                return response.data;
              }));
    request.subscribe({
      next: (data) => {
        const term = this.searchText.trim().toLocaleLowerCase();
        this.records.set(term && (section === 'types-sortie' || section === 'lieux')
          ? data.filter((item) => `${this.nameOf(item)} ${this.codeOf(item)} ${this.descriptionOf(item)}`.toLocaleLowerCase().includes(term))
          : data);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(this.errorText(error));
      },
    });
  }

  private loadServices(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      services: this.api.listServices({ search: this.searchText, page: this.currentPage() }),
      directions: this.api.listDirections('', 1),
    }).subscribe({
      next: ({ services, directions }) => {
        this.directions.set(directions.data);
        this.records.set(services.data);
        this.lastPage.set(services.meta?.last_page ?? 1);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(this.errorText(error));
      },
    });
  }

  private loadDirections(): void {
    this.api.listDirections().subscribe({
      next: (response) => this.directions.set(response.data),
      error: (error: HttpErrorResponse) => this.errorMessage.set(this.errorText(error)),
    });
  }

  private runMutation<T>(request: import('rxjs').Observable<T>, success: string): void {
    this.saving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editor.set(null);
        this.successMessage.set(success);
        this.loadRecords();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(this.errorText(error));
      },
    });
  }

  private parseCoordinate(value: number | null): number | null {
    return value !== null && Number.isFinite(value) ? value : null;
  }

  private saveChauffeur(): void {
    if (!this.draft.nom.trim() || !this.draft.prenom.trim() || !this.draft.email.trim() || !this.draft.direction_id || !this.draft.current_password) {
      this.errorMessage.set('Nom, prénom, e-mail, direction et mot de passe administrateur sont obligatoires.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    this.usersApi.create({ nom: this.draft.nom.trim(), prenom: this.draft.prenom.trim(), email: this.draft.email.trim(), direction_id: this.draft.direction_id!, role: 'chauffeur' }).pipe(
      switchMap(({ user }) => this.usersApi.revealTemporaryPassword(user.id, user.password_generation ?? 1, user.lock_version ?? 0, this.draft.current_password, 'Communication initiale du compte chauffeur').pipe(
        map((secret) => ({ password: secret.temporary_password, revealError: '' })),
        catchError((error: HttpErrorResponse) => of({ password: '', revealError: this.errorText(error) })),
      )),
    ).subscribe({
      next: ({ password, revealError }) => {
        this.saving.set(false);
        this.editor.set(null);
        this.successMessage.set(password ? 'Compte chauffeur créé. Mot de passe temporaire à communiquer au chauffeur :' : 'Compte chauffeur créé.');
        this.errorMessage.set(revealError ? `Le compte est créé, mais le mot de passe temporaire n’a pas pu être révélé. ${revealError}` : '');
        this.temporaryPassword.set(password);
        this.draft.current_password = '';
        this.loadRecords();
      },
      error: (error: HttpErrorResponse | Error) => {
        this.saving.set(false);
        this.errorMessage.set(error instanceof HttpErrorResponse ? this.errorText(error) : error.message || 'Impossible de créer le compte chauffeur.');
      },
    });
  }

  private errorText(error: HttpErrorResponse): string {
    if (error.status === 409) return error.error?.message || 'La ressource a changé ou est utilisée. Recharge les données puis réessaie.';
    if (error.status === 401) return 'Session expirée. Reconnecte-toi pour continuer.';
    if (error.status === 403) return 'Ton compte ne possède pas la permission nécessaire.';
    if (error.status === 422 && error.error?.errors) return (Object.values(error.error.errors) as string[][]).flat().join(' ');
    return error.error?.message || 'La demande a échoué. Réessaie.';
  }
}
