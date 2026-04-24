import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import './PlayerStats.css';
import { useUser } from '../UserContextCore';
import { ROLES, normalizeRole } from '../permissions';

export default function PlayerStats() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const memberName = state?.member?.name || 'Player';
  const memberTeamId = state?.member?.teamId; 
  const user = useUser();
  const normalizedRole = normalizeRole(user.role);
  
  const [stats, setStats] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
    
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    opponent: '', playedOn: new Date().toISOString().split('T')[0],
    kills: 0, attackErrors: 0, attackAttempts: 0, aces: 0, blocks: 0, digs: 0, assists: 0, receiveRating: '',
    coachNotes: '' 
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/api/stats/players/${id}`, { token: user.token });
        // Ensure data is always an array to prevent crashes
        setStats(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (user?.token) {
      fetchStats();
    }
  }, [id, user]);

  const activeStat = stats[selectedIndex] || null;

  return (
    <div className="ps-container">
      <div className="ps-bg-pattern" aria-hidden="true" />

      <header className="ps-header">
        <div className="ps-header-left">
          <img src={logo} alt="VolleyOps" className="ps-logo" />
          <h1 className="ps-title">{memberName.toUpperCase()} STATS</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {(normalizedRole === ROLES.MANAGER || normalizedRole === ROLES.COACH) && (
            <button 
              className="ps-back-btn" 
              onClick={() => setIsModalOpen(true)}
              style={{ background: '#6b7bb8', color: 'white', border: 'none' }}
            >
              + Log Match
            </button>
          )}
          <button className="ps-back-btn" onClick={() => navigate(-1)}>Back <span>&larr;</span></button>
        </div>
      </header>

      {loading ? (
        <div className="ps-empty">Loading performance data...</div>
      ) : error ? (
        <div className="ps-empty error">{error}</div>
      ) : stats.length === 0 ? (
        <div className="ps-empty">No match data recorded for this player yet.</div>
      ) : (
        <div className="ps-content">
          
          {/* Match Selector */}
          <div className="ps-match-selector">
            <h3>Match History</h3>
            <div className="ps-match-list">
              {stats.map((stat, idx) => (
                <button 
                  key={stat.id || idx} 
                  className={`ps-match-btn ${idx === selectedIndex ? 'active' : ''}`}
                  onClick={() => setSelectedIndex(idx)}
                >
                  <span className="ps-match-date">
                    {stat.playedOn ? new Date(stat.playedOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown Date'}
                  </span>
                  <span className="ps-match-vs">vs {stat.opponent || 'Unknown'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Dashboard - Wrapped safely */}
          {activeStat && (
            <div className="ps-dashboard">
              
              {/* AI Coach Panel */}
              <div className="ps-ai-panel">
                <div className="ps-ai-header">
                  <span className="ps-ai-icon">✨</span>
                  <h2>AI Coach Analysis</h2>
                  {activeStat.feedback?.tone && (
                    <span className="ps-ai-tone badge">{activeStat.feedback.tone}</span>
                  )}
                </div>
                <p className="ps-ai-text">
                  {activeStat.feedback?.coachEditedText || activeStat.feedback?.generatedText || "No feedback generated for this match."}
                </p>
              </div>

              {/* Top Level Metrics */}
              <div className="ps-metrics-row">
                <div className="ps-metric-card primary">
                  <span className="ps-metric-label">Performance Score</span>
                  <span className="ps-metric-value">{activeStat.performanceScore || 0}</span>
                  <span className="ps-metric-sub">Team Avg: {activeStat.teamAverageScore || 0}</span>
                </div>
                <div className="ps-metric-card">
                  <span className="ps-metric-label">Hitting %</span>
                  {/* Safely format hitting percentage */}
                  <span className="ps-metric-value">{Number(activeStat.hittingPercentage || 0).toFixed(3)}</span>
                </div>
                <div className="ps-metric-card">
                  <span className="ps-metric-label">Receive Rating</span>
                  <span className="ps-metric-value">{activeStat.receiveRating || 'N/A'}</span>
                </div>
              </div>

              {/* Detail Grid */}
              <h3 className="ps-grid-title">Raw Match Statistics</h3>
              <div className="ps-metrics-grid">
                <MetricBox label="Kills" value={activeStat.kills || 0} />
                <MetricBox label="Attack Errors" value={activeStat.attackErrors || 0} />
                <MetricBox label="Attempts" value={activeStat.attackAttempts || 0} />
                <MetricBox label="Aces" value={activeStat.aces || 0} />
                <MetricBox label="Blocks" value={activeStat.blocks || 0} />
                <MetricBox label="Digs" value={activeStat.digs || 0} />
                <MetricBox label="Assists" value={activeStat.assists || 0} />
              </div>

            </div>
          )}
        </div>
      )}

      {/* ── ADD MATCH MODAL ── */}
      {isModalOpen && (
        <div 
          className="ps-modal-overlay" 
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }} 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="ps-modal" 
            style={{ background: '#fff', borderRadius: '20px', padding: '36px', width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }} 
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px', color: '#1e293b' }}>Log Match Performance</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                // Send single-player match payload to the backend
                await apiFetch('/api/stats/matches', {
                  method: 'POST',
                  token: user.token,
                  body: JSON.stringify({
                    teamId: memberTeamId || 1, // Fallback if teamId is missing
                    opponent: formData.opponent,
                    playedOn: formData.playedOn,
                    tone: 'analytical',
                    playerStats: [{
                      playerId: id,
                      ...formData,
                      // Ensure numbers are properly cast
                      kills: Number(formData.kills), attackErrors: Number(formData.attackErrors),
                      attackAttempts: Number(formData.attackAttempts), aces: Number(formData.aces),
                      blocks: Number(formData.blocks), digs: Number(formData.digs),
                      assists: Number(formData.assists), receiveRating: Number(formData.receiveRating || 0)
                    }]
                  })
                });
                setIsModalOpen(false);
                window.location.reload(); // Quick refresh to show new data
              } catch (err) { alert(err.message); }
            }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>Opponent</label>
                  <input required type="text" value={formData.opponent} onChange={e => setFormData({...formData, opponent: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>Date</label>
                  <input required type="date" value={formData.playedOn} onChange={e => setFormData({...formData, playedOn: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}/>
                </div>
              </div>
              
              <label style={{ fontWeight: '800', display: 'block', margin: '24px 0 12px', color: '#1e293b' }}>Raw Stats</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {['kills', 'attackErrors', 'attackAttempts', 'aces', 'blocks', 'digs', 'assists', 'receiveRating'].map(stat => (
                  <div key={stat}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                      {stat.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <input type="number" step="0.1" min="0" value={formData[stat]} onChange={e => setFormData({...formData, [stat]: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                ))}
              </div>

              <label style={{ fontWeight: '800', display: 'block', margin: '24px 0 12px', color: '#1e293b' }}>Coach's Tactical Notes (For AI Analysis)</label>
              <textarea 
                rows="3" 
                placeholder="e.g. Struggled with serve receive on short balls, but blocking timing was excellent..."
                value={formData.coachNotes} 
                onChange={e => setFormData({...formData, coachNotes: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#6b7bb8', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Save & Generate AI Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const MetricBox = ({ label, value }) => (
  <div className="ps-box">
    <span className="ps-box-value">{value}</span>
    <span className="ps-box-label">{label}</span>
  </div>
);