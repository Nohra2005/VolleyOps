import React from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { UserProvider } from './UserContext';
import { useUser } from './UserContextCore';
import { ROLES, normalizeRole } from './permissions';

import Home from './features/Home';
import Scheduling from './features/Scheduling';
import ClubManagement from './features/ClubManagement';
import PlayerProfile from './features/PlayerProfile';
import CoachIBoard from './features/CoachIBoard';
import AdminUsers from './features/AdminUsers';

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

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/scheduling"
            element={<RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}><Scheduling /></RequireAuth>}
          />
          <Route
            path="/team-management"
            element={<RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH]}><ClubManagement /></RequireAuth>}
          />
          <Route
            path="/player-profile/:id"
            element={<RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH]}><PlayerProfile /></RequireAuth>}
          />
          <Route
            path="/communication"
            element={<RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}><Home /></RequireAuth>}
          />
          <Route
            path="/athlete-stats"
            element={<RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER]}><Home /></RequireAuth>}
          />
          <Route
            path="/coach-iboard"
            element={<RequireAuth allowRoles={[ROLES.MANAGER, ROLES.COACH]}><CoachIBoard /></RequireAuth>}
          />
          <Route
            path="/admin/users"
            element={<RequireAuth allowRoles={[ROLES.MANAGER]}><AdminUsers /></RequireAuth>}
          />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
