import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContext';
import './Home.css';

import logo              from '../assets/logo.png';
import iconScheduling    from '../assets/icon-scheduling.png';
import iconTeam          from '../assets/icon-team.png';
import iconCommunication from '../assets/icon-communication.png';
import iconStats         from '../assets/icon-stats.png';
import iconIboard        from '../assets/icon-iboard.png';
import heroSlide1        from '../assets/hero-bg-1.png';
import heroSlide2        from '../assets/hero-bg-2.png';

const FEATURE_ROUTES = {
  'Scheduling':      '/scheduling',
  'Team Management': '/team-management',
  'Communication':   '/communication',
  'Athlete Stats':   '/athlete-stats',
  'Coach iBoard':    '/coach-iboard',
};

export default function Home() {
  const navigate = useNavigate();
  const user     = useUser();

  const [currentSlide, setCurrentSlide] = useState(0);
  const heroSlides = [heroSlide1, heroSlide2];

  const features = [
    { name: 'Scheduling',      icon: iconScheduling },
    { name: 'Team Management', icon: iconTeam },
    { name: 'Communication',   icon: iconCommunication },
    { name: 'Athlete Stats',   icon: iconStats },
    { name: 'Coach iBoard',    icon: iconIboard },
  ];

  const nextSlide = useCallback(() => setCurrentSlide(p => (p + 1) % heroSlides.length), [heroSlides.length]);
  const prevSlide = () => setCurrentSlide(p => (p - 1 + heroSlides.length) % heroSlides.length);

  useEffect(() => {
    const t = setInterval(nextSlide, 5000);
    return () => clearInterval(t);
  }, [nextSlide]);

  // Derive initials from user name
  const userInitials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="navbar-safe-zone">
          {/* Logo + wordmark */}
          <div className="logo-container">
            <img src={logo} alt="VolleyOps Logo" className="logo" />
            <span className="logo-text">VolleyOps</span>
          </div>

          {/* User chip — initials from context, not hardcoded */}
          <div className="profile-container">
            <div className="avatar-initials">{userInitials}</div>
            <span className="profile-name">{user.name}</span>
          </div>
        </div>
      </nav>

      <section className="hero-section">
        {heroSlides.map((slide, i) => (
          <div key={i} className={`hero-slide ${i === currentSlide ? 'active' : ''}`}>
            <img src={slide} alt={`Slide ${i + 1}`} className="hero-image" />
          </div>
        ))}
        <div className="hero-controls-wrapper">
          <button className="carousel-arrow left" onClick={prevSlide} aria-label="Previous">&#10094;</button>
          <button className="carousel-arrow right" onClick={nextSlide} aria-label="Next">&#10095;</button>
          <div className="carousel-dots">
            {heroSlides.map((_, i) => (
              <button key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} onClick={() => setCurrentSlide(i)} />
            ))}
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className="feature-card" onClick={() => navigate(FEATURE_ROUTES[feature.name] || '/')} title={feature.name}>
              <img src={feature.icon} alt={feature.name} className="feature-image" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}