import React from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { UserProvider } from './UserContext';
import { useUser } from './UserContextCore';
import { ROLES, normalizeRole } from './permissions';

import Home from './features/Home';
import Scheduling from './features/Scheduling';
import ClubManagement from './features/ClubManagement';
import PlayerProfile from './features/PlayerProfile';
import PlayerStats from './features/PlayerStats';
import CoachIBoard from './features/CoachIBoard';
import AdminUsers from './features/AdminUsers';
import Communication from './features/Communication';

function RequireAuth({ children, allowRoles = [] }) {
  const user = useUser();

  if (!user.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowRoles.length > 0 && !allowRoles.includes(normalizeRole(user.role))) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AthleteStatsRedirect() {
  const user = useUser();
  const normalizedRole = normalizeRole(user.role);

  if (normalizedRole === ROLES.PLAYER) {
    return <Navigate to={`/player-profile/${user.id}/stats`} replace />;
  }

  return <Navigate to="/team-management" replace />;
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/scheduling"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}>
                <Scheduling />
              </RequireAuth>
            }
          />

          <Route
            path="/team-management"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH]}>
                <ClubManagement />
              </RequireAuth>
            }
          />

          <Route
            path="/player-profile/:id"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH]}>
                <PlayerProfile />
              </RequireAuth>
            }
          />

          <Route
            path="/player-profile/:id/stats"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}>
                <PlayerStats />
              </RequireAuth>
            }
          />

          <Route
            path="/athlete-stats"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}>
                <AthleteStatsRedirect />
              </RequireAuth>
            }
          />

          <Route
            path="/communication"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}>
                <Communication />
              </RequireAuth>
            }
          />

          <Route
            path="/coach-iboard"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH]}>
                <CoachIBoard />
              </RequireAuth>
            }
          />

          <Route
            path="/admin/users"
            element={
              <RequireAuth allowRoles={[ROLES.MANAGER]}>
                <AdminUsers />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
