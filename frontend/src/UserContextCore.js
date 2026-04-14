import { createContext, useContext } from 'react';
import { normalizeRole, ROLES } from './permissions';

export const STORAGE_KEY = 'volleyops-auth';
export const GUEST_USER = { name: 'Guest', initials: 'G', role: ROLES.GUEST };

export const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

export const UserContext = createContext({
  ...GUEST_USER,
  token: '',
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export const useUser = () => useContext(UserContext);
export const normalizeSessionUser = (user = GUEST_USER) => ({
  ...user,
  role: normalizeRole(user.role || GUEST_USER.role),
});
