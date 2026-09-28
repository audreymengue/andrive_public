import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Role {
  id?: number;
  code: string;
  libelle: string;
  description: string;
}

export interface User {
  id: number;
  nom: string;
  email: string;
  roleCode: string;
}

export interface Permission {
  id: number;
  code: string;
  libelle: string;
  selected?: boolean;
}

@Component({
  selector: 'app-list-role-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-role.page.html',
  styleUrls: ['./list-role.page.scss']
})
export class ListRolePage implements OnInit {
  searchTerm: string = '';

  roles: Role[] = [
    {
      id: 1,
      code: 'role-user',
      libelle: 'Utilisateur',
      description: 'Rôle d’un utilisateur normal'
    },
    {
      id: 2,
      code: 'role-admin',
      libelle: 'Administrateur',
      description: 'Gestion complète du système'
    }
  ];

  // Modale Ajouter / Modifier Rôle
  isModalOpen: boolean = false;
  isEditMode: boolean = false;
  newRole: Role = {
    code: '',
    libelle: '',
    description: ''
  };

  // Modale Consultation des utilisateurs
  isUsersModalOpen: boolean = false;
  selectedRoleForUsers: Role | null = null;
  usersOfSelectedRole: User[] = [];

  // Données de démonstration pour les utilisateurs
  allUsers: User[] = [
    { id: 1, nom: 'Jean Dupont', email: 'jean.dupont@aninf.ga', roleCode: 'role-user' },
    { id: 2, nom: 'Alice Martin', email: 'alice.martin@aninf.ga', roleCode: 'role-admin' },
    { id: 3, nom: 'Marc Nzoghe', email: 'marc.nzoghe@aninf.ga', roleCode: 'role-user' }
  ];

  // Modale Association des permissions
  isPermissionsModalOpen: boolean = false;
  selectedRoleForPermissions: Role | null = null;
  availablePermissions: Permission[] = [
    { id: 1, code: 'perm_read', libelle: 'Consulter les éléments' },
    { id: 2, code: 'perm_create', libelle: 'Créer de nouveaux enregistrements' },
    { id: 3, code: 'perm_edit', libelle: 'Modifier les enregistrements existants' },
    { id: 4, code: 'perm_delete', libelle: 'Supprimer des enregistrements' }
  ];

  constructor(private location: Location) {}

  ngOnInit(): void {}

  goBack(): void {
    this.location.back();
  }

  get filteredRoles(): Role[] {
    if (!this.searchTerm.trim()) {
      return this.roles;
    }
    const term = this.searchTerm.toLowerCase();
    return this.roles.filter(r =>
      r.code.toLowerCase().includes(term) ||
      r.libelle.toLowerCase().includes(term) ||
      (r.description && r.description.toLowerCase().includes(term))
    );
  }

  // --- ACTION 1: Afficher la liste des utilisateurs du rôle ---
  viewUsers(role: Role): void {
    this.selectedRoleForUsers = role;
    this.usersOfSelectedRole = this.allUsers.filter(u => u.roleCode === role.code);
    this.isUsersModalOpen = true;
  }

  closeUsersModal(): void {
    this.isUsersModalOpen = false;
    this.selectedRoleForUsers = null;
    this.usersOfSelectedRole = [];
  }

  // --- ACTION 2: Afficher la modale d'association des permissions ---
  assignPermissions(role: Role): void {
    this.selectedRoleForPermissions = role;
    
    // Exemple : réinitialisation / pré-cochage fictif selon le rôle
    this.availablePermissions = this.availablePermissions.map(p => ({
      ...p,
      selected: role.code === 'role-admin' ? true : p.code === 'perm_read'
    }));

    this.isPermissionsModalOpen = true;
  }

  closePermissionsModal(): void {
    this.isPermissionsModalOpen = false;
    this.selectedRoleForPermissions = null;
  }

  savePermissions(): void {
    const selected = this.availablePermissions.filter(p => p.selected);
    console.log(`Permissions enregistrées pour le rôle ${this.selectedRoleForPermissions?.code}:`, selected);
    this.closePermissionsModal();
  }

  // --- Modale Ajouter / Modifier un Rôle ---
  openAddModal(): void {
    this.isEditMode = false;
    this.newRole = { code: '', libelle: '', description: '' };
    this.isModalOpen = true;
  }

  openEditModal(role: Role): void {
    this.isEditMode = true;
    this.newRole = { ...role };
    this.isModalOpen = true;
  }

  closeAddModal(): void {
    this.isModalOpen = false;
  }

  saveRole(): void {
    if (this.newRole.code && this.newRole.libelle) {
      if (this.isEditMode) {
        const index = this.roles.findIndex(r => r.id === this.newRole.id);
        if (index !== -1) {
          this.roles[index] = { ...this.newRole };
        }
      } else {
        this.roles.push({
          ...this.newRole,
          id: Date.now()
        });
      }
      this.closeAddModal();
    }
  }

  // --- Action 3: Supprimer un rôle ---
  deleteRole(id?: number): void {
    if (id && confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) {
      this.roles = this.roles.filter(r => r.id !== id);
    }
  }
}