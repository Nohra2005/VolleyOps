import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserContext } from './UserContext';

import Home           from './features/Home';
import Scheduling     from './features/Scheduling';
import ClubManagement from './features/ClubManagement';
import PlayerProfile  from './features/PlayerProfile';

// ── Swap this for real auth data when ready ───────────────────────────────────
const CURRENT_USER = {
  name:     'Tatiana',
  initials: 'T',
  role:     'Admin',
};

export default function App() {
  return (
    <UserContext.Provider value={CURRENT_USER}>
      <BrowserRouter>
        <Routes>
          <Route path="/"                        element={<Home />} />
          <Route path="/scheduling"              element={<Scheduling />} />
          <Route path="/team-management"         element={<ClubManagement />} />
          <Route path="/player-profile/:id"      element={<PlayerProfile />} />
          {/* Placeholder routes for future screens */}
          <Route path="/communication"           element={<Home />} />
          <Route path="/athlete-stats"           element={<Home />} />
          <Route path="/coach-iboard"            element={<Home />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}