import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  PermissionService,
  Permission
} from '../../services/permission.service';

@Component({
  selector: 'app-list-permission-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './list-permission.page.html',
  styleUrls: ['./list-permission.page.scss']
})
export class ListPermissionPage implements OnInit {

  private readonly permissionService = inject(PermissionService);
  private readonly location = inject(Location);

  searchTerm = '';

  permissions: Permission[] = [];

  isLoading = false;
  errorMessage = '';

  isModalOpen = false;
  isEditMode = false;

  newPermission: Permission = {
    id: 0,
    code: '',
    libelle: '',
    description: ''
  };

  ngOnInit(): void {
    this.loadPermissions();
  }

  /**
   * Retour à la page précédente
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Charger les permissions depuis Laravel
   */
  loadPermissions(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.permissionService.list().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        this.isLoading = false;

        console.log('Permissions récupérées depuis API :', permissions);
      },

      error: (error) => {
        this.isLoading = false;

        console.error(
          'Erreur lors du chargement des permissions :',
          error
        );

        this.errorMessage =
          error?.error?.message ??
          'Impossible de charger les permissions.';
      }
    });
  }

  /**
   * Recherche
   */
  get filteredPermissions(): Permission[] {

    if (!this.searchTerm.trim()) {
      return this.permissions;
    }

    const term = this.searchTerm
      .toLowerCase()
      .trim();

    return this.permissions.filter(permission =>
      permission.code
        ?.toLowerCase()
        .includes(term) ||

      permission.libelle
        ?.toLowerCase()
        .includes(term) ||

      permission.description
        ?.toLowerCase()
        .includes(term)
    );
  }

  /**
   * Ouvrir la fenêtre d'ajout
   */
  openAddModal(): void {

    this.isEditMode = false;

    this.newPermission = {
      id: 0,
      code: '',
      libelle: '',
      description: ''
    };

    this.errorMessage = '';
    this.isModalOpen = true;
  }

  /**
   * Ouvrir la fenêtre de modification
   */
  openEditModal(permission: Permission): void {

    this.isEditMode = true;

    this.newPermission = {
      ...permission
    };

    this.errorMessage = '';
    this.isModalOpen = true;
  }

  /**
   * Fermer la fenêtre
   */
  closeAddModal(): void {
    this.isModalOpen = false;
    this.errorMessage = '';
  }

  /**
   * Ajouter ou modifier une permission
   */
  savePermission(): void {

    if (
      !this.newPermission.code.trim() ||
      !this.newPermission.libelle.trim()
    ) {
      this.errorMessage =
        'Le code et le libellé sont obligatoires.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      code: this.newPermission.code.trim(),
      libelle: this.newPermission.libelle.trim(),
      description:
        this.newPermission.description?.trim() || ''
    };

    /**
     * MODIFICATION
     */
    if (this.isEditMode) {

      if (!this.newPermission.id) {
        this.isLoading = false;
        this.errorMessage =
          'Identifiant de permission invalide.';
        return;
      }

      this.permissionService
        .update(this.newPermission.id, payload)
        .subscribe({

          next: (updatedPermission) => {

            const index = this.permissions.findIndex(
              permission =>
                permission.id === updatedPermission.id
            );

            if (index !== -1) {
              this.permissions[index] = updatedPermission;
            }

            this.isLoading = false;
            this.closeAddModal();

            console.log(
              'Permission modifiée :',
              updatedPermission
            );
          },

          error: (error) => {

            this.isLoading = false;

            console.error(
              'Erreur modification permission :',
              error
            );

            this.errorMessage =
              error?.error?.message ??
              'Impossible de modifier la permission.';
          }
        });

      return;
    }

    /**
     * CRÉATION
     */
    this.permissionService
      .create(payload)
      .subscribe({

        next: (createdPermission) => {

          this.permissions = [
            ...this.permissions,
            createdPermission
          ];

          this.isLoading = false;
          this.closeAddModal();

          console.log(
            'Permission créée :',
            createdPermission
          );
        },

        error: (error) => {

          this.isLoading = false;

          console.error(
            'Erreur création permission :',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Impossible de créer la permission.';
        }
      });
  }

  /**
   * Supprimer une permission
   */
  deletePermission(id?: number): void {

    if (!id) {
      return;
    }

    const permission = this.permissions.find(
      item => item.id === id
    );

    if (!permission) {
      return;
    }

    const confirmed = confirm(
      `Êtes-vous sûr de vouloir supprimer la permission "${permission.code}" ?`
    );

    if (!confirmed) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.permissionService
      .delete(id)
      .subscribe({

        next: () => {

          this.permissions = this.permissions.filter(
            item => item.id !== id
          );

          this.isLoading = false;

          console.log(
            'Permission supprimée :',
            id
          );
        },

        error: (error) => {

          this.isLoading = false;

          console.error(
            'Erreur suppression permission :',
            error
          );

          this.errorMessage =
            error?.error?.message ??
            'Impossible de supprimer la permission.';
        }
      });
  }
}