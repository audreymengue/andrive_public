import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  CreateRoleDto,
  Permission,
  Role,
  RoleService,
  UpdateRoleDto,
} from '../../services/role.service';

@Component({
  selector: 'app-list-role-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './list-role.page.html',
  styleUrls: ['./list-role.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListRolePage implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly location = inject(Location);

  // État des données
  protected readonly roles = signal<Role[]>([]);
  protected readonly availablePermissions = signal<Permission[]>([]);
  protected readonly selectedPermissions = signal<number[]>([]);

  // États de chargement et recherche
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly filteredRoles = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.roles();
    return this.roles().filter((role) =>
      [role.nom, role.description].some((value) => value?.toLowerCase().includes(term))
    );
  });

  // Modale rôle (Ajouter / Modifier)
  protected readonly isModalOpen = signal(false);
  protected readonly isEditMode = signal(false);
  protected readonly editingRole = signal<Role>({
    id: 0,
    nom: '',
    statut: 'ACTIF',
    description: '',
  });

  // Modale permissions
  protected readonly isPermissionModalOpen = signal(false);
  protected readonly selectedRoleForPermissions = signal<Role | null>(null);

  // NOUVEAU : Modale consultation des permissions (lecture seule)
  protected readonly viewedRole = signal<Role | null>(null);

  ngOnInit(): void {
    this.loadRoles();
  }

  protected loadRoles(): void {
    this.isLoading.set(true);
    this.roleService.getRoles().subscribe({
      next: (data: any) => {
        this.roles.set(data.data ?? []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected goBack(): void {
    this.location.back();
  }

  // NOUVEAU : consultation des permissions d'un rôle (lecture seule)
  protected viewRolePermissions(role: Role): void {
    this.viewedRole.set(role);
  }

  protected closeViewPermissions(): void {
    this.viewedRole.set(null);
  }

  // --- GESTION DU FORMULAIRE DE RÔLE ---

  protected openAddModal(): void {
    this.isEditMode.set(false);
    this.editingRole.set({
      id: 0,
      nom: '',
      statut: 'ACTIF',
      description: '',
    });
    this.isModalOpen.set(true);
  }

  protected openEditModal(role: Role): void {
    this.isEditMode.set(true);
    this.editingRole.set({ ...role });
    this.isModalOpen.set(true);
  }

  protected closeAddModal(): void {
    this.isModalOpen.set(false);
  }

  protected updateEditingField(field: keyof Role, value: string): void {
    this.editingRole.update((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  protected saveRole(): void {
    const current = this.editingRole();
    const nom = current.nom || '';
    const description = current.description || '';
    const statut = current.statut || '';

    if (!nom) return;

    this.isSaving.set(true);

    if (this.isEditMode() && current.id > 0) {
      const updateDto: UpdateRoleDto = {
        nom: nom,
        description: description,
        statut: statut,
      };

      this.roleService.updateRole(current.id, updateDto).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeAddModal();
          this.loadRoles();
        },
        error: () => this.isSaving.set(false),
      });
    } else {
      const createDto: CreateRoleDto = {
        nom: nom,
        description: description,
        statut: statut,
      };

      this.roleService.createRole(createDto).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeAddModal();
          this.loadRoles();
        },
        error: () => this.isSaving.set(false),
      });
    }
  }

  protected deleteRole(id: number): void {
    if (!confirm('Voulez-vous vraiment supprimer ce rôle ?')) return;

    this.roleService.deleteRole(id).subscribe({
      next: () => this.loadRoles(),
    });
  }

  // --- GESTION DES PERMISSIONS ---

  protected openAssignPermissionsModal(role: Role): void {
    this.selectedRoleForPermissions.set(role);
    this.isPermissionModalOpen.set(true);
    this.roleService.getPermissions().subscribe({
      next: (reponse) => {
        this.availablePermissions.set(reponse.data ?? []);
        if (this.availablePermissions().length > 0 && (role.permissions && role.permissions.length > 0)) {
          const selected = role.permissions.map(permission => permission.id);
          this.selectedPermissions.set(selected);
        } else {
          this.selectedPermissions.set([]);
        }
      }
    });
  }

  protected closePermissionModal(): void {
    this.isPermissionModalOpen.set(false);
    this.selectedRoleForPermissions.set(null);
  }

  protected isPermissionSelected(permId: number): boolean {
    return this.selectedPermissions().includes(permId);
  }

  protected togglePermissionSelection(permId: number): void {
    this.selectedPermissions.update((current) =>
      current.includes(permId)
        ? current.filter((id) => id !== permId)
        : [...current, permId]
    );
  }

  protected saveRolePermissions(): void {
    const role = this.selectedRoleForPermissions();
    if (!role) return;

    this.roleService
      .assignPermissionsToRole(role.id, this.selectedPermissions())
      .subscribe({
        next: (response) => {
          this.selectedRoleForPermissions.set(response.data);
          this.closePermissionModal();
          this.loadRoles();
        },
      });
  }
}
