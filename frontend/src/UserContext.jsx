import { createContext, useContext } from 'react';

export const UserContext = createContext({ name: 'Tatiana', initials: 'T', role: 'Admin' });
export const useUser = () => useContext(UserContext);