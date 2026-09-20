import { User } from '@/core/services/core.service';

/**
 * ⚠️ TEMPORAIRE — comptes de démonstration utilisés tant que l'API /login
 * du backend n'est pas branchée. Supprimer ce fichier (et son usage dans
 * login.page.ts) une fois l'API réelle disponible.
 */
export interface MockAccount {
  email: string;
  password: string;
  user: User;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    email: 'agent@aninf.cd',
    password: 'password',
    user: {
      id: 1,
      name: 'Agent ANINF',
      email: 'agent@aninf.cd',
      roles: ['agent'],
      mustChangePassword: true, // simule une 1ère connexion
    },
  },
  {
    email: 'dag@aninf.cd',
    password: 'password',
    user: {
      id: 2,
      name: 'Agent DAG',
      email: 'dag@aninf.cd',
      roles: ['dag'],
      mustChangePassword: false,
    },
  },
  {
    email: 'chauffeur@aninf.cd',
    password: 'password',
    user: {
      id: 3,
      name: 'Chauffeur Pool',
      email: 'chauffeur@aninf.cd',
      roles: ['pool_chauffeur'],
      mustChangePassword: false,
    },
  },
  {
    email: 'admin@aninf.cd',
    password: 'password',
    user: {
      id: 4,
      name: 'Administrateur',
      email: 'admin@aninf.cd',
      roles: ['administrateur'],
      mustChangePassword: false,
    },
  },
];