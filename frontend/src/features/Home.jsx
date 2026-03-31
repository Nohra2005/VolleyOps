import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

import logo from '../assets/logo.png';
import iconScheduling from '../assets/icon-scheduling.png';
import iconTeam from '../assets/icon-team.png';
import iconCommunication from '../assets/icon-communication.png';
import iconStats from '../assets/icon-stats.png';
import iconIboard from '../assets/icon-iboard.png';

import heroSlide1 from '../assets/hero-bg-1.png'; 
import heroSlide2 from '../assets/hero-bg-2.png'; 

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const heroSlides = [heroSlide1, heroSlide2];

  const features = [
    { name: 'Scheduling', icon: iconScheduling, path: '/scheduling' },
    { name: 'Team Management', icon: iconTeam, path: '/team-management' },
    { name: 'Communication', icon: iconCommunication, path: '/communication' },
    { name: 'Athlete Stats', icon: iconStats, path: '/stats' },
    { name: 'Coach iBoard', icon: iconIboard, path: '/iboard' },
  ];

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="navbar-safe-zone">
          <div className="logo-container">
            <img src={logo} alt="VolleyOps Logo" className="logo" />
            <span className="logo-text">VolleyOps</span>
          </div>
          <div className="profile-container">
            <div className="avatar-placeholder"></div>
            <span className="profile-name">Tatiana</span>
          </div>
        </div>
      </nav>

      <section className="hero-section">
        {heroSlides.map((slide, index) => (
          <div key={index} className={`hero-slide ${index === currentSlide ? 'active' : ''}`}>
            <img src={slide} alt={`Slide ${index + 1}`} className="hero-image" />
          </div>
        ))}

        <div className="hero-controls-wrapper">
          <button className="carousel-arrow left" onClick={prevSlide}>
            &#10094;
          </button>
          <button className="carousel-arrow right" onClick={nextSlide}>
            &#10095;
          </button>
          <div className="carousel-dots">
            {heroSlides.map((_, index) => (
              <button 
                key={index} 
                className={`dot ${index === currentSlide ? 'active' : ''}`} 
                onClick={() => setCurrentSlide(index)} 
              />
            ))}
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid">
          {features.map((feature, index) => (
            <div 
              className="feature-card" 
              key={index}
              onClick={() => navigate(feature.path)}
            >
              <img src={feature.icon} alt={feature.name} className="feature-image" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}