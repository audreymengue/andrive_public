// src/app/features/administration/models/user.model.ts

/** Préfixe d'URL du module. */
export const USERS_BASE_PATH = '/administration/list-users';

export type StatutCode = 'ACTIF' | 'INACTIF';

export interface Permission {
  id: number;
  code: string;
  libelle: string;
  description?: string;
}

export interface Role {
  id: number;
  nom: string;
  description?: string;
  statut?: StatutCode;
  permissions?: Permission[];
}

export interface Direction {
  id: number;
  code: string;
  nom: string;
}

/**
 * Liste officielle des directions (departement_id) extraite de la documentation officielle.
 */
export const DIRECTIONS: readonly Direction[] = [
  { id: 1, code: 'DG', nom: 'Direction Générale' },
  { id: 2, code: 'DF', nom: 'Direction Financière' },
  { id: 3, code: 'DRH', nom: 'Direction des Ressources Humaines' },
  { id: 4, code: 'DJ', nom: 'Direction Juridique' },
  { id: 5, code: 'DCM', nom: 'Direction de la Communication et du Marketing' },
  { id: 6, code: 'DAP', nom: 'Direction des Applications' },
  { id: 7, code: 'DISI', nom: 'Direction de la Sécurité et de l\'Information' },
  { id: 8, code: 'DFA', nom: 'Direction des Fréquences et de l\'Audiovisuel' },
  { id: 9, code: 'DCSI', nom: 'Direction Centrale du Système d\'Information' },
  { id: 10, code: 'DAQSO', nom: 'Direction de l\'Audit, la Qualité, la Stratégie et l\'Organisation' },
  { id: 11, code: 'DIR', nom: 'Direction de l\'Ingénierie et des Réseaux' },
  { id: 12, code: 'DAG', nom: 'Direction des Affaires Générales' },
];

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  statut: StatutCode;
  must_change_password: boolean;
  departement_id: number | null;
  roles: Role[];
}

/** Envoyé à la création et à la modification. Le statut se change via activate/deactivate, pas ici. */
export interface UserPayload {
  nom: string;
  prenom: string;
  email: string;
  departement_id: number | null;
}

/** Format de pagination natif de Laravel (API Resources). */
export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export const fullName = (u: Pick<User, 'prenom' | 'nom'>): string => `${u.prenom} ${u.nom}`.trim();
export const isActif = (u: Pick<User, 'statut'>): boolean => u.statut === 'ACTIF';
export const roleNames = (u: Pick<User, 'roles'>): string[] => u.roles.map((r) => r.nom);
export const directionLabel = (id: number | null): string => {
  if (id === null) return '—';
  const found = DIRECTIONS.find((d) => d.id === id);
  return found ? `${found.nom} (${found.code})` : `Direction #${id}`;
};