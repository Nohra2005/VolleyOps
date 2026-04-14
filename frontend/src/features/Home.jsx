import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContextCore';
import { FEATURES, canAccessFeature } from '../permissions';
import './Home.css';
import AuthModal from './AuthModal';

import logo              from '../assets/logo.png';
import iconScheduling    from '../assets/icon-scheduling.png';
import iconTeam          from '../assets/icon-team.png';
import iconAdmin         from '../assets/icon-admin.png';
import iconCommunication from '../assets/icon-communication.png';
import iconStats         from '../assets/icon-stats.png';
import iconIboard        from '../assets/icon-iboard.png';
import heroSlide1        from '../assets/hero-bg-1.png';
import heroSlide2        from '../assets/hero-bg-2.png';

const FEATURE_ROUTES = {
  [FEATURES.SCHEDULING]: '/scheduling',
  [FEATURES.TEAM_MANAGEMENT]: '/team-management',
  [FEATURES.COMMUNICATION]: '/communication',
  [FEATURES.ATHLETE_STATS]: '/athlete-stats',
  [FEATURES.COACH_IBOARD]: '/coach-iboard',
  [FEATURES.ADMIN_USERS]: '/admin/users',
};

export default function Home() {
  const navigate = useNavigate();
  const user     = useUser();
  const isLoggedOut = !user.isAuthenticated;

  const [currentSlide, setCurrentSlide] = useState(0);
  const heroSlides = [heroSlide1, heroSlide2];

  const allFeatures = [
    { name: FEATURES.SCHEDULING, icon: iconScheduling },
    { name: FEATURES.TEAM_MANAGEMENT, icon: iconTeam },
    { name: FEATURES.COMMUNICATION, icon: iconCommunication },
    { name: FEATURES.ATHLETE_STATS, icon: iconStats },
    { name: FEATURES.COACH_IBOARD, icon: iconIboard },
    { name: FEATURES.ADMIN_USERS, icon: iconAdmin },
  ];

  const features = isLoggedOut
    ? allFeatures.filter((feature) => feature.name !== FEATURES.ADMIN_USERS)
    : allFeatures.filter((feature) => canAccessFeature(user.role, feature.name));

  const nextSlide = useCallback(() => setCurrentSlide(p => (p + 1) % heroSlides.length), [heroSlides.length]);
  const prevSlide = () => setCurrentSlide(p => (p - 1 + heroSlides.length) % heroSlides.length);

  useEffect(() => {
    const t = setInterval(nextSlide, 5000);
    return () => clearInterval(t);
  }, [nextSlide]);

  const userInitials = user.initials || user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const profileLabel = isLoggedOut ? 'Log In' : user.name;
  const [showAuth, setShowAuth] = useState(false);

  const handleFeatureSelect = (featureName) => {
    if (isLoggedOut) {
      setShowAuth(true);
      return;
    }
    navigate(FEATURE_ROUTES[featureName] || '/');
  };

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
          <div
            className="profile-container"
            role="button"
            tabIndex={0}
            onClick={() => setShowAuth(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowAuth(true); } }}
            aria-label="Open login and signup window"
          >
            <div className="avatar-initials">{userInitials}</div>
            <span className="profile-name">{profileLabel}</span>
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

      <section className={`features-section ${isLoggedOut ? 'features-section-locked' : ''}`}>
        <div className={`features-grid ${isLoggedOut ? 'features-grid-locked' : ''}`} aria-hidden={isLoggedOut}>
          {features.map((feature, i) => (
            <div
              key={i}
              className={`feature-card ${isLoggedOut ? 'feature-card-locked' : ''}`}
              onClick={() => handleFeatureSelect(feature.name)}
              title={feature.name}
            >
              <img src={feature.icon} alt={feature.name} className="feature-image" />
            </div>
          ))}
        </div>
        {isLoggedOut && (
          <div className="feature-lock-overlay">
            <div className="feature-lock-card">
              <p className="feature-lock-eyebrow">Restricted Access</p>
              <h2>Log in to access VolleyOps</h2>
              <p>
                Sign in to unlock your role-based VolleyOps workspace.
              </p>
              <button type="button" className="feature-lock-button" onClick={() => setShowAuth(true)}>
                Open Login
              </button>
            </div>
          </div>
        )}
      </section>
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
