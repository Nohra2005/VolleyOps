import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './UserContext';

import Home from './features/Home';
import Scheduling from './features/Scheduling';
import ClubManagement from './features/ClubManagement';
import PlayerProfile from './features/PlayerProfile';
import CoachIBoard from './features/CoachIBoard';
import AdminUsers from './features/AdminUsers';

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/team-management" element={<ClubManagement />} />
          <Route path="/player-profile/:id" element={<PlayerProfile />} />
          <Route path="/communication" element={<Home />} />
          <Route path="/athlete-stats" element={<Home />} />
          <Route path="/coach-iboard" element={<CoachIBoard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
