import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import { useUser } from '../UserContextCore';
import { ROLES, normalizeRole } from '../permissions';
import './PlayerStats.css';

const EMPTY_FORM = {
  opponent: '',
  playedOn: new Date().toISOString().split('T')[0],
  venue: '',
  tone: 'analytical',
  kills: 0,
  attackErrors: 0,
  attackAttempts: 0,
  aces: 0,
  blocks: 0,
  digs: 0,
  assists: 0,
  receiveRating: '',
  coachNotes: '',
};

const fmtNumber = (value, decimals = 2) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(decimals) : '0';
};

const fmtDate = (value) => {
  if (!value) return 'Unknown Date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const scoreLabel = (score) => {
  const n = Number(score || 0);
  if (n >= 55) return 'Elite';
  if (n >= 35) return 'Strong';
  if (n >= 20) return 'Developing';
  return 'Needs Work';
};

export default function PlayerStats() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const user = useUser();
  const normalizedRole = normalizeRole(user.role);

  const canLogMatch = normalizedRole === ROLES.MANAGER || normalizedRole === ROLES.COACH;

  const [payload, setPayload] = useState(null);
  const [teamSummary, setTeamSummary] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const player = payload?.player || state?.member || null;
  const stats = payload?.stats || [];
  const activeStat = stats[selectedIndex] || null;
  const seasonAverages = payload?.seasonAverages || {};
  const teamComparison = payload?.teamComparison || {};
  const trend = payload?.trend || {};

  const memberName = player?.name || state?.member?.name || user.name || 'Player';
  const playerTeamId = player?.teamId || state?.member?.teamId || user.teamId || activeStat?.teamId;

  const improvementBadge = useMemo(() => {
    const delta = Number(trend.performanceScoreDelta || 0);
    if (delta > 0) return { label: `+${delta} since last match`, type: 'positive' };
    if (delta < 0) return { label: `${delta} since last match`, type: 'negative' };
    return { label: 'Stable trend', type: 'neutral' };
  }, [trend.performanceScoreDelta]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await apiFetch(`/api/stats/players/${id}`, { token: user.token });

      if (Array.isArray(data)) {
        setPayload({
          player: state?.member || { id, name: state?.member?.name || 'Player' },
          stats: data,
          latest: data[0] || null,
          seasonAverages: {},
          teamComparison: {},
          trend: {},
        });
      } else {
        setPayload(data);
      }

      setSelectedIndex(0);
    } catch (err) {
      setError(err.message || 'Could not load performance data.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamSummary = async (teamId) => {
    if (!teamId || !user?.token) return;

    try {
      setTeamLoading(true);
      const data = await apiFetch(`/api/stats/teams/${teamId}/summary`, { token: user.token });
      setTeamSummary(data);
    } catch {
      setTeamSummary(null);
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.token]);

  useEffect(() => {
    if (playerTeamId) loadTeamSummary(playerTeamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerTeamId, user?.token]);

  const updateForm = (patch) => setFormData((current) => ({ ...current, ...patch }));

  const submitMatch = async (e) => {
    e.preventDefault();

    if (!playerTeamId) {
      alert('This player must be assigned to a team before logging stats.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await apiFetch('/api/stats/matches', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          teamId: Number(playerTeamId),
          opponent: formData.opponent,
          playedOn: formData.playedOn,
          venue: formData.venue,
          tone: formData.tone,
          coachNotes: formData.coachNotes,
          playerStats: [
            {
              playerId: Number(id),
              kills: Number(formData.kills),
              attackErrors: Number(formData.attackErrors),
              attackAttempts: Number(formData.attackAttempts),
              aces: Number(formData.aces),
              blocks: Number(formData.blocks),
              digs: Number(formData.digs),
              assists: Number(formData.assists),
              receiveRating: formData.receiveRating === '' ? null : Number(formData.receiveRating),
              coachNotes: formData.coachNotes,
            },
          ],
        }),
      });

      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      setSuccess('Match saved and Volley-GPT feedback generated.');
      window.setTimeout(() => setSuccess(''), 3000);
      await loadStats();
      await loadTeamSummary(playerTeamId);
    } catch (err) {
      setError(err.message || 'Could not save match stats.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ps-container">
      <div className="ps-bg-pattern" aria-hidden="true" />

      <header className="ps-header">
        <div className="ps-header-left">
          <img src={logo} alt="VolleyOps" className="ps-logo" />
          <div>
            <h1 className="ps-title">{memberName.toUpperCase()} STATS</h1>
            <p className="ps-subtitle">Season averages, match score, team comparison, and Volley-GPT summaries.</p>
          </div>
        </div>

        <div className="ps-header-actions">
          {canLogMatch && (
            <button className="ps-primary-btn" onClick={() => setIsModalOpen(true)}>
              + Log Match
            </button>
          )}
          <button className="ps-back-btn" onClick={() => navigate(-1)}>Back <span>&larr;</span></button>
        </div>
      </header>

      {(error || success) && (
        <div className={`ps-alert ${error ? 'error' : 'success'}`}>
          {error || success}
        </div>
      )}

      {loading ? (
        <div className="ps-empty">Loading performance data...</div>
      ) : stats.length === 0 ? (
        <div className="ps-empty">
          <h2>No match data recorded yet.</h2>
          <p>Once a coach logs a match, this page will show score, averages, comparison, and Volley-GPT feedback.</p>
          {canLogMatch && <button className="ps-primary-btn" onClick={() => setIsModalOpen(true)}>Log First Match</button>}
        </div>
      ) : (
        <>
          <section className="ps-season-grid">
            <SeasonCard label="Matches Played" value={seasonAverages.matchesPlayed || stats.length} />
            <SeasonCard label="Avg Score" value={fmtNumber(seasonAverages.performanceScore, 1)} highlight />
            <SeasonCard label="Avg Hitting %" value={Number(seasonAverages.hittingPercentage || 0).toFixed(3)} />
            <SeasonCard label="Avg Kills" value={fmtNumber(seasonAverages.kills, 1)} />
            <SeasonCard label="Avg Digs" value={fmtNumber(seasonAverages.digs, 1)} />
            <SeasonCard label="Vs Team Avg" value={`${teamComparison.delta >= 0 ? '+' : ''}${fmtNumber(teamComparison.delta, 1)}`} />
          </section>

          <div className="ps-content">
            <aside className="ps-match-selector">
              <h3>Match History</h3>
              <div className="ps-match-list">
                {stats.map((stat, idx) => (
                  <button
                    key={stat.id || idx}
                    className={`ps-match-btn ${idx === selectedIndex ? 'active' : ''}`}
                    onClick={() => setSelectedIndex(idx)}
                  >
                    <span className="ps-match-date">{fmtDate(stat.playedOn)}</span>
                    <span className="ps-match-vs">vs {stat.opponent || 'Unknown'}</span>
                    <span className="ps-match-score">Score {stat.performanceScore || 0}</span>
                  </button>
                ))}
              </div>
            </aside>

            {activeStat && (
              <main className="ps-dashboard">
                <section className="ps-ai-panel">
                  <div className="ps-ai-header">
                    <span className="ps-ai-icon">✨</span>
                    <h2>Volley-GPT Match Summary</h2>
                    {activeStat.feedback?.tone && <span className="ps-ai-tone badge">{activeStat.feedback.tone}</span>}
                  </div>
                  <p className="ps-ai-text">
                    {activeStat.feedback?.displayText || activeStat.feedback?.coachEditedText || activeStat.feedback?.generatedText || 'No AI feedback generated for this match.'}
                  </p>
                  {activeStat.coachNotes && <p className="ps-coach-notes">Coach notes: {activeStat.coachNotes}</p>}
                </section>

                <section className="ps-metrics-row">
                  <div className="ps-metric-card primary">
                    <span className="ps-metric-label">Performance Score</span>
                    <span className="ps-metric-value">{activeStat.performanceScore || 0}</span>
                    <span className="ps-metric-sub">
                      {scoreLabel(activeStat.performanceScore)} • Team Avg: {activeStat.teamAverageScore || 0}
                    </span>
                  </div>

                  <div className="ps-metric-card">
                    <span className="ps-metric-label">Team Comparison</span>
                    <span className={`ps-metric-value ${Number(activeStat.scoreVsTeamAverage || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {Number(activeStat.scoreVsTeamAverage || 0) >= 0 ? '+' : ''}{activeStat.scoreVsTeamAverage || 0}
                    </span>
                    <span className="ps-metric-sub dark">Score vs match average</span>
                  </div>

                  <div className="ps-metric-card">
                    <span className="ps-metric-label">Hitting %</span>
                    <span className="ps-metric-value">{Number(activeStat.hittingPercentage || 0).toFixed(3)}</span>
                    <span className="ps-metric-sub dark">{activeStat.kills || 0} kills / {activeStat.attackAttempts || 0} attempts</span>
                  </div>

                  <div className="ps-metric-card">
                    <span className="ps-metric-label">Trend</span>
                    <span className={`ps-trend-pill ${improvementBadge.type}`}>{improvementBadge.label}</span>
                    <span className="ps-metric-sub dark">Compared with previous match</span>
                  </div>
                </section>

                <h3 className="ps-grid-title">Raw Match Statistics</h3>
                <section className="ps-metrics-grid">
                  <MetricBox label="Kills" value={activeStat.kills || 0} />
                  <MetricBox label="Attack Errors" value={activeStat.attackErrors || 0} />
                  <MetricBox label="Attempts" value={activeStat.attackAttempts || 0} />
                  <MetricBox label="Aces" value={activeStat.aces || 0} />
                  <MetricBox label="Blocks" value={activeStat.blocks || 0} />
                  <MetricBox label="Digs" value={activeStat.digs || 0} />
                  <MetricBox label="Assists" value={activeStat.assists || 0} />
                  <MetricBox label="Receive Rating" value={activeStat.receiveRating ?? 'N/A'} />
                </section>

                {teamSummary && (
                  <section className="ps-team-panel">
                    <div>
                      <h3>Coach Team Summary</h3>
                      <p>
                        {teamLoading
                          ? 'Loading team summary...'
                          : teamSummary.recentSummaries?.[0]?.generatedSummary || 'No team AI summary generated yet.'}
                      </p>
                    </div>
                    <div className="ps-team-mini-grid">
                      <MetricBox label="Team Avg Score" value={teamSummary.averagePerformance || 0} />
                      <MetricBox label="Team Hit %" value={Number(teamSummary.averageHittingPercentage || 0).toFixed(3)} />
                      <MetricBox label="Strongest" value={teamSummary.totals?.strongestMetric || '—'} small />
                      <MetricBox label="Improve" value={teamSummary.totals?.weakestMetric || '—'} small />
                    </div>
                  </section>
                )}
              </main>
            )}
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="ps-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Log Match Performance</h2>

            <form onSubmit={submitMatch}>
              <div className="ps-form-row">
                <FormField label="Opponent" required value={formData.opponent} onChange={(v) => updateForm({ opponent: v })} />
                <FormField label="Date" required type="date" value={formData.playedOn} onChange={(v) => updateForm({ playedOn: v })} />
              </div>

              <div className="ps-form-row">
                <FormField label="Venue" value={formData.venue} onChange={(v) => updateForm({ venue: v })} />
                <div className="ps-form-group">
                  <label>AI Tone</label>
                  <select value={formData.tone} onChange={(e) => updateForm({ tone: e.target.value })}>
                    <option value="analytical">Analytical</option>
                    <option value="encouraging">Encouraging</option>
                    <option value="direct">Direct</option>
                    <option value="standard">Standard</option>
                  </select>
                </div>
              </div>

              <h3 className="ps-form-title">Raw Stats</h3>
              <div className="ps-stat-form-grid">
                {[
                  ['kills', 'Kills'],
                  ['attackErrors', 'Attack Errors'],
                  ['attackAttempts', 'Attempts'],
                  ['aces', 'Aces'],
                  ['blocks', 'Blocks'],
                  ['digs', 'Digs'],
                  ['assists', 'Assists'],
                  ['receiveRating', 'Receive Rating'],
                ].map(([key, label]) => (
                  <FormField
                    key={key}
                    label={label}
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData[key]}
                    onChange={(v) => updateForm({ [key]: v })}
                  />
                ))}
              </div>

              <div className="ps-form-group">
                <label>Coach Tactical Notes for Volley-GPT</label>
                <textarea
                  rows="4"
                  placeholder="Example: Struggled on short serve receive early, but blocking timing improved in set two."
                  value={formData.coachNotes}
                  onChange={(e) => updateForm({ coachNotes: e.target.value })}
                />
              </div>

              <div className="ps-modal-actions">
                <button type="button" className="ps-cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="ps-save-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save & Generate AI Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SeasonCard = ({ label, value, highlight }) => (
  <div className={`ps-season-card ${highlight ? 'highlight' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const MetricBox = ({ label, value, small }) => (
  <div className={`ps-box ${small ? 'small' : ''}`}>
    <span className="ps-box-value">{value}</span>
    <span className="ps-box-label">{label}</span>
  </div>
);

const FormField = ({ label, value, onChange, type = 'text', required = false, min, step }) => (
  <div className="ps-form-group">
    <label>{label}</label>
    <input
      required={required}
      type={type}
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);