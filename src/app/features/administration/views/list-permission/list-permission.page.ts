import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { PermissionService } from '../../services/permission.service';

export interface Permission {
  id: number;
  code: string;
  libelle: string;
  description?: string;
}

@Component({
  selector: 'app-list-permission',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-permission.page.html',
  styleUrls: ['./list-permission.page.scss']
})
export class ListPermissionPage implements OnInit {
  private permissionService = inject(PermissionService);
  private location = inject(Location);

  permissions = signal<Permission[]>([]);
  searchTerm = signal<string>('');
  isModalOpen = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  editingPermission: Permission = {
    id: 0,
    code: '',
    libelle: '',
    description: ''
  };

  filteredPermissions = computed(() => {
    const list = this.permissions();
    const term = this.searchTerm().toLowerCase().trim();

    // Sécurité 1 : s'assurer que list est toujours un tableau
    if (!Array.isArray(list)) return [];

    if (!term) return list;

    // Sécurité 2 : gestion des champs null ou undefined lors du filtrage
    return list.filter(p => {
      const codeMatch = p.code ? p.code.toLowerCase().includes(term) : false;
      const libelleMatch = p.libelle ? p.libelle.toLowerCase().includes(term) : false;
      return codeMatch || libelleMatch;
    });
  });

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.permissionService.getPermissions().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (response: any) => {
        // Extraction sécurisée selon le format renvoyé par Laravel
        if (Array.isArray(response)) {
          this.permissions.set(response);
        } else if (response && Array.isArray(response.data)) {
          // Cas de pagination ou de Laravel ApiResource
          this.permissions.set(response.data);
        } else {
          console.warn('Format de réponse inattendu :', response);
          this.permissions.set([]);
        }
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des permissions :', err);
        this.errorMessage.set('Impossible de charger la liste des permissions.');
        this.permissions.set([]);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  openAddModal(): void {
    this.editingPermission = { id: 0, code: '', libelle: '', description: '' };
    this.errorMessage.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(permission: Permission): void {
    this.editingPermission = { ...permission };
    this.errorMessage.set(null);
    this.isModalOpen.set(true);
  }

  closeAddModal(): void {
    if (this.isSaving()) return;
    this.isModalOpen.set(false);
  }

  savePermission(): void {
    if (!this.editingPermission.code || !this.editingPermission.libelle) {
      this.errorMessage.set('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const save$ = this.editingPermission.id
      ? this.permissionService.updatePermission(this.editingPermission.id, this.editingPermission)
      : this.permissionService.createPermission(this.editingPermission);

    save$.subscribe({
      next: (response: any) => {
        const savedPermission: Permission = response.data ?? response;

        this.permissions.update(list => {
          const currentList = Array.isArray(list) ? list : [];
          return this.editingPermission.id
            ? currentList.map(p => (p.id === savedPermission.id ? savedPermission : p))
            : [...currentList, savedPermission];
        });

        this.isSaving.set(false);
        this.closeAddModal();
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message ?? 'Erreur lors de l’enregistrement de la permission.');
        this.isSaving.set(false);
      }
    });
  }

  deletePermission(id: number): void {
    if (!confirm('Voulez-vous vraiment supprimer cette permission ?')) return;

    this.errorMessage.set(null);

    this.permissionService.deletePermission(id).subscribe({
      next: () => {
        this.permissions.update(list => {
          const currentList = Array.isArray(list) ? list : [];
          return currentList.filter(p => p.id !== id);
        });
      },
      error: () => {
        this.errorMessage.set('Erreur lors de la suppression de la permission.');
      }
    });
  }
}
