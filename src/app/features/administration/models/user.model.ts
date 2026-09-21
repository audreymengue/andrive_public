/** Préfixe d'URL du module. À adapter si le module est monté ailleurs dans app.routes.ts. */
export const USERS_BASE_PATH = '/administration/list-users';

export type RoleCode = 'ROLE_USER' | 'ROLE_ADMIN';
export type ProfilCode = 'AGENT' | 'CHAUFFEUR';

export interface RoleOption {
  code: RoleCode;
  label: string;
  description: string;
}

export interface ProfilOption {
  code: ProfilCode;
  label: string;
}

export const ROLE_OPTIONS: readonly RoleOption[] = [
  { code: 'ROLE_USER', label: 'Utilisateur', description: 'Accès standard à la plateforme.' },
  {
    code: 'ROLE_ADMIN',
    label: 'Administrateur',
    description: 'Gère les utilisateurs, les référentiels et les demandes.',
  },
];

export const PROFIL_OPTIONS: readonly ProfilOption[] = [
  { code: 'AGENT', label: 'Agent (demandeur)' },
  { code: 'CHAUFFEUR', label: 'Chauffeur' },
];

export interface User {
  id: number;
  login: string;
  nom: string;
  prenom: string;
  actif: boolean;
  profil: ProfilCode;
  roles: RoleCode[];
  /** true tant que l'utilisateur n'a pas remplacé son mot de passe par défaut. */
  must_change_password: boolean;
  created_at?: string;
}

/** Données envoyées à la création / modification. Le mot de passe par défaut est géré par le backend. */
export type UserPayload = Pick<User, 'login' | 'nom' | 'prenom' | 'actif' | 'profil' | 'roles'>;

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
export const isAdmin = (u: Pick<User, 'roles'>): boolean => u.roles.includes('ROLE_ADMIN');