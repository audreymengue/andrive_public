import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, switchMap } from 'rxjs';

import { Role, User } from '../../models/user.model';
import { Permission, PermissionService } from '../../services/permission.service';
import { RoleService } from '../../services/role.service';
import { UserService } from '../../services/user.service';

interface SelectablePermission extends Permission {
  selected?: boolean;
}

@Component({
  selector: 'app-list-role-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-role.page.html',
  styleUrls: ['./list-role.page.scss'],
})
export class ListRolePage implements OnInit {
  private readonly rolesApi = inject(RoleService);
  private readonly permissionsApi = inject(PermissionService);
  private readonly usersApi = inject(UserService);
  private readonly location = inject(Location);

  searchTerm = '';
  roles: Role[] = [];
  loading = false;
  errorMessage = '';
  saving = false;

  isModalOpen = false;
  isEditMode = false;
  newRole: { id?: number; nom: string; description: string } = { nom: '', description: '' };

  isUsersModalOpen = false;
  selectedRoleForUsers: Role | null = null;
  usersOfSelectedRole: User[] = [];
  loadingUsers = false;
  usersError = '';

  isPermissionsModalOpen = false;
  selectedRoleForPermissions: Role | null = null;
  availablePermissions: SelectablePermission[] = [];
  permissionsError = '';

  ngOnInit(): void {
    this.loadRoles();
  }

  goBack(): void {
    this.location.back();
  }

  loadRoles(): void {
    this.loading = true;
    this.errorMessage = '';
    this.rolesApi.list().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message ?? 'Impossible de charger les rôles.';
      },
    });
  }

  get filteredRoles(): Role[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.roles;
    return this.roles.filter((role) =>
      role.nom.toLowerCase().includes(term) || (role.description ?? '').toLowerCase().includes(term),
    );
  }

  viewUsers(role: Role): void {
    this.selectedRoleForUsers = role;
    this.usersOfSelectedRole = [];
    this.loadingUsers = true;
    this.usersError = '';
    this.isUsersModalOpen = true;
    this.usersApi.list({ page: 1, perPage: 100 }).pipe(
      switchMap((firstPage) => firstPage.meta.last_page <= 1
        ? [firstPage.data]
        : forkJoin(Array.from({ length: firstPage.meta.last_page - 1 }, (_, index) =>
            this.usersApi.list({ page: index + 2, perPage: 100 }).pipe(map((page) => page.data)),
          )).pipe(map((otherPages) => [...firstPage.data, ...otherPages.flat()])),
      ),
    ).subscribe({
      next: (users) => {
        this.usersOfSelectedRole = users.filter((user) => user.roles.some((item) => item.id === role.id));
        this.loadingUsers = false;
      },
      error: (error) => {
        this.loadingUsers = false;
        this.usersError = error?.error?.message ?? 'Impossible de charger les utilisateurs du rôle.';
      },
    });
  }

  closeUsersModal(): void {
    this.isUsersModalOpen = false;
    this.selectedRoleForUsers = null;
    this.usersOfSelectedRole = [];
    this.usersError = '';
  }

  assignPermissions(role: Role): void {
    this.selectedRoleForPermissions = role;
    this.permissionsError = '';
    this.isPermissionsModalOpen = true;
    this.permissionsApi.list().subscribe({
      next: (permissions) => {
        const assigned = new Set((role.permissions ?? []).map((permission) => permission.id));
        this.availablePermissions = permissions.map((permission) => ({
          ...permission,
          selected: assigned.has(permission.id),
        }));
      },
      error: (error) => {
        this.permissionsError = error?.error?.message ?? 'Impossible de charger les permissions.';
      },
    });
  }

  closePermissionsModal(): void {
    this.isPermissionsModalOpen = false;
    this.selectedRoleForPermissions = null;
    this.permissionsError = '';
  }

  savePermissions(): void {
    const role = this.selectedRoleForPermissions;
    if (!role) return;
    const ids = this.availablePermissions.filter((permission) => permission.selected).map((permission) => permission.id);
    this.saving = true;
    this.rolesApi.assignPermissions(role.id, ids).subscribe({
      next: (updated) => {
        this.roles = this.roles.map((item) => item.id === updated.id ? updated : item);
        this.saving = false;
        this.closePermissionsModal();
      },
      error: (error) => {
        this.saving = false;
        this.permissionsError = error?.error?.message ?? "Impossible d'enregistrer les permissions du rôle.";
      },
    });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.newRole = { nom: '', description: '' };
    this.errorMessage = '';
    this.isModalOpen = true;
  }

  openEditModal(role: Role): void {
    this.isEditMode = true;
    this.newRole = { id: role.id, nom: role.nom, description: role.description ?? '' };
    this.errorMessage = '';
    this.isModalOpen = true;
  }

  closeAddModal(): void {
    this.isModalOpen = false;
  }

  saveRole(): void {
    const nom = this.newRole.nom.trim();
    if (!nom) {
      this.errorMessage = 'Le nom du rôle est obligatoire.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    const payload = { nom, description: this.newRole.description.trim() || undefined };
    const request = this.isEditMode && this.newRole.id
      ? this.rolesApi.update(this.newRole.id, payload)
      : this.rolesApi.create(payload);
    request.subscribe({
      next: (role) => {
        this.roles = this.isEditMode
          ? this.roles.map((item) => item.id === role.id ? role : item)
          : [...this.roles, role];
        this.saving = false;
        this.closeAddModal();
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error?.error?.message ?? "Impossible d'enregistrer le rôle.";
      },
    });
  }

  deleteRole(id?: number): void {
    if (!id || !confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) return;
    this.rolesApi.delete(id).subscribe({
      next: () => this.roles = this.roles.filter((role) => role.id !== id),
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'Impossible de supprimer ce rôle.';
      },
    });
  }
}
