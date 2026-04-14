import { createContext, useContext } from 'react';

export const STORAGE_KEY = 'volleyops-auth';
export const GUEST_USER = { name: 'Tatiana', initials: 'T', role: 'GUEST' };

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
