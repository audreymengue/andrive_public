import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Permission {
  id?: number;
  code: string;
  libelle: string;
  description: string;
}

@Component({
  selector: 'app-list-permission-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-permission.page.html',
  styleUrls: ['./list-permission.page.scss']
})
export class ListPermissionPage implements OnInit {
  searchTerm: string = '';

  permissions: Permission[] = [
    {
      id: 1,
      code: 'create_user',
      libelle: 'Créer un utilisateur',
      description: 'Permet de créer un utilisateur'
    },
    {
      id: 2,
      code: 'update_user',
      libelle: 'Modifier un utilisateur',
      description: 'Permet de modifier les informations d’un utilisateur'
    }
  ];

  isModalOpen: boolean = false;
  isEditMode: boolean = false;

  newPermission: Permission = {
    code: '',
    libelle: '',
    description: ''
  };

  constructor(private location: Location) {}

  ngOnInit(): void {}

  // Action du bouton Retour
  goBack(): void {
    this.location.back();
  }

  get filteredPermissions(): Permission[] {
    if (!this.searchTerm.trim()) {
      return this.permissions;
    }
    const term = this.searchTerm.toLowerCase();
    return this.permissions.filter(p =>
      p.code.toLowerCase().includes(term) ||
      p.libelle.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term))
    );
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.newPermission = { code: '', libelle: '', description: '' };
    this.isModalOpen = true;
  }

  openEditModal(permission: Permission): void {
    this.isEditMode = true;
    this.newPermission = { ...permission };
    this.isModalOpen = true;
  }

  closeAddModal(): void {
    this.isModalOpen = false;
  }

  savePermission(): void {
    if (this.newPermission.code && this.newPermission.libelle) {
      if (this.isEditMode) {
        const index = this.permissions.findIndex(p => p.id === this.newPermission.id);
        if (index !== -1) {
          this.permissions[index] = { ...this.newPermission };
        }
      } else {
        this.permissions.push({
          ...this.newPermission,
          id: Date.now()
        });
      }
      this.closeAddModal();
    }
  }

  deletePermission(id?: number): void {
    if (id && confirm('Êtes-vous sûr de vouloir supprimer cette permission ?')) {
      this.permissions = this.permissions.filter(p => p.id !== id);
    }
  }
}