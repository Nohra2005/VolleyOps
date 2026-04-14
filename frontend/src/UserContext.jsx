import { useCallback, useMemo, useState } from 'react';
import { GUEST_USER, getInitials, STORAGE_KEY, UserContext } from './UserContextCore';

const readStoredSession = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { token: '', user: GUEST_USER };
  } catch {
    return { token: '', user: GUEST_USER };
  }
};

export function UserProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const login = useCallback(({ token, user }) => {
    const nextSession = {
      token,
      user: { ...user, initials: getInitials(user.name) },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession({ token: '', user: GUEST_USER });
  }, []);

  const value = useMemo(
    () => ({
      ...GUEST_USER,
      ...(session.user || {}),
      initials: getInitials(session.user?.name || GUEST_USER.name),
      token: session.token || '',
      isAuthenticated: Boolean(session.token),
      login,
      logout,
    }),
    [session, login, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
