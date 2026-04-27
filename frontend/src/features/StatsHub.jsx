import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import { useUser } from '../UserContextCore';
import { ROLES, normalizeRole } from '../permissions';
import './PlayerStats.css';

export default function StatsHub() {
  const user = useUser();
  const navigate = useNavigate();
  const normalizedRole = normalizeRole(user.role);

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ role: 'PLAYER' });
        if (normalizedRole === ROLES.COACH && user.teamId) {
          params.set('teamId', user.teamId);
        }
        const [memberData, teamData] = await Promise.all([
          apiFetch(`/api/members?${params}`, { token: user.token }),
          normalizedRole === ROLES.MANAGER
            ? apiFetch('/api/teams', { token: user.token })
            : Promise.resolve([]),
        ]);
        setPlayers(memberData || []);
        setTeams(teamData || []);
      } catch {
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };
    if (user?.token) load();
  }, [user?.token]);

  const filtered = players.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.position || '').toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !teamFilter || String(p.teamId) === teamFilter;
    return matchesSearch && matchesTeam;
  });

  const grouped = filtered.reduce((acc, p) => {
    const key = p.team || 'No Team';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="ps-container">
      <div className="ps-bg-pattern" aria-hidden="true" />

      <header className="ps-header">
        <div className="ps-header-left">
          <img src={logo} alt="VolleyOps" className="ps-logo" />
          <div>
            <h1 className="ps-title">ATHLETE STATS</h1>
            <p className="ps-subtitle">Select a player to view their performance data.</p>
          </div>
        </div>
        <div className="ps-header-actions">
          <button className="ps-back-btn" onClick={() => navigate('/')}>
            Back <span>&larr;</span>
          </button>
        </div>
      </header>

      <div style={{ padding: '0 32px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search player or position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1.5px solid #e2e8f0',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        {normalizedRole === ROLES.MANAGER && teams.length > 0 && (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              fontSize: '14px',
              background: 'white',
            }}
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="ps-empty">Loading players...</div>
      ) : filtered.length === 0 ? (
        <div className="ps-empty">No players found.</div>
      ) : (
        <div style={{ padding: '0 32px 40px' }}>
          {Object.entries(grouped).map(([teamName, teamPlayers]) => (
            <div key={teamName} style={{ marginBottom: '32px' }}>
              <h3
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  marginBottom: '12px',
                }}
              >
                {teamName}
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                {teamPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() =>
                      navigate(`/player-profile/${player.id}/stats`, {
                        state: { member: { name: player.name, teamId: player.teamId } },
                      })
                    }
                    style={{
                      background: 'white',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#6b7bb8';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(107,123,184,0.18)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6b7bb8, #8b9fd4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '15px',
                        marginBottom: '12px',
                      }}
                    >
                      {player.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>
                      {player.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {player.position || 'No position'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
