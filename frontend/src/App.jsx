import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './features/Home';
import Scheduling from './features/Scheduling';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scheduling" element={<Scheduling />} />
      </Routes>
    </BrowserRouter>
  );
}