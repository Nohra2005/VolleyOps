import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserContext } from './UserContext';

import Home from './features/Home';
import Scheduling from './features/Scheduling';
import ClubManagement from './features/ClubManagement';
import PlayerProfile from './features/PlayerProfile';
import CoachIBoard from './features/CoachIBoard';

const CURRENT_USER = {
  name: 'Tatiana',
  initials: 'T',
  role: 'Admin',
};

export default function App() {
  return (
    <UserContext.Provider value={CURRENT_USER}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/team-management" element={<ClubManagement />} />
          <Route path="/player-profile/:id" element={<PlayerProfile />} />
          <Route path="/communication" element={<Home />} />
          <Route path="/athlete-stats" element={<Home />} />
          <Route path="/coach-iboard" element={<CoachIBoard />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}