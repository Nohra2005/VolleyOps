import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch, formatApiDate } from '../lib/api';
import { useUser } from '../UserContextCore';
import './PlayerProfile.css';

const AVATAR_COLORS = ['#6b7bb8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Overdue', 'Inactive'];
const POSITION_PRESETS = ['Setter', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Libero', 'Defensive Specialist', 'Coach', 'Assistant Coach', 'Head Coach'];

const safeText = (value) => String(value ?? '').trim();

const avatarColor = (name) => AVATAR_COLORS[(safeText(name).charCodeAt(0) || 0) % AVATAR_COLORS.length];

const getInitials = (name = '') => {
  const clean = safeText(name);
  if (!clean) return '?';
  return clean
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const fmt = (val) => safeText(val) || '—';

const fmtDate = (val) => {
  if (!val) return '—';
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return val;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const calculateAge = (val) => {
  if (!val) return null;
  const birthDate = new Date(val);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const isPaymentWarning = (member) => {
  if (['Overdue', 'Pending'].includes(member.payment)) return true;
  if (!member.nextPayment) return false;

  const nextPayment = new Date(member.nextPayment);
  if (Number.isNaN(nextPayment.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return nextPayment < today;
};

const EMPTY_MEMBER = {
  id: null,
  name: 'Unknown Member',
  email: '',
  role: 'PLAYER',
  phone: '',
  emergencyContact: '',
  dateOfBirth: '',
  team: '',
  teamId: '',
  position: '',
  attendanceRate: '',
  payment: 'Inactive',
  nextPayment: '',
  joined: '',
  joinedDate: '',
  lastActive: '',
  lastActiveAt: '',
};

export default function PlayerProfile() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();
  const user = useUser();

  const [member, setMember] = useState({ ...EMPTY_MEMBER, ...(state?.member || {}) });
  const [teams, setTeams] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_MEMBER, ...(state?.member || {}) });
  const [loading, setLoading] = useState(!state?.member);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const age = useMemo(() => calculateAge(member.dateOfBirth), [member.dateOfBirth]);
  const paymentWarning = useMemo(() => isPaymentWarning(member), [member]);

  const selectedTeam = useMemo(() => {
    return teams.find((team) => String(team.id) === String(member.teamId));
  }, [teams, member.teamId]);

  const profileCompleteness = useMemo(() => {
    const keys = ['name', 'email', 'phone', 'emergencyContact', 'dateOfBirth', 'teamId', 'position', 'attendanceRate', 'payment', 'nextPayment'];
    const complete = keys.filter((key) => safeText(member[key])).length;
    return Math.round((complete / keys.length) * 100);
  }, [member]);

  useEffect(() => {
    setForm({
      ...member,
      dateOfBirth: formatApiDate(member.dateOfBirth || ''),
      nextPayment: formatApiDate(member.nextPayment || ''),
      teamId: member.teamId ? String(member.teamId) : '',
      attendanceRate: member.attendanceRate ?? '',
    });
  }, [member]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');

        const [memberData, teamsData] = await Promise.all([
          apiFetch(`/api/members/${id}`, { token: user.token }),
          apiFetch('/api/teams', { token: user.token }),
        ]);

        setMember({ ...EMPTY_MEMBER, ...memberData });
        setTeams(teamsData || []);
      } catch (err) {
        setError(err.message || 'Could not load this profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id, user.token]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const saveEdit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError('');

      const updated = await apiFetch(`/api/members/${id}`, {
        method: 'PUT',
        token: user.token,
        body: JSON.stringify({
          ...form,
          name: safeText(form.name),
          email: safeText(form.email).toLowerCase(),
          teamId: form.teamId ? Number(form.teamId) : null,
          attendanceRate: form.attendanceRate === '' ? null : Number(form.attendanceRate),
        }),
      });

      setMember({ ...EMPTY_MEMBER, ...updated });
      setEditOpen(false);
      setSuccess('Profile updated successfully.');
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const f = (key) => form[key] ?? '';

  return (
    <div className="pp-container">
      <div className="pp-bg-pattern" aria-hidden="true" />

      <header className="pp-header">
        <div className="pp-header-left">
          <img src={logo} alt="VolleyOps" className="pp-logo" />
          <div>
            <h1 className="pp-title">PLAYER PROFILE</h1>
            <p className="pp-subtitle">Dedicated profile page with personal, athlete, and payment sections.</p>
          </div>
        </div>
        <button className="pp-back-btn" onClick={() => navigate(-1)}>Back <span>&larr;</span></button>
      </header>

      {(error || success) && (
        <div className={`pp-alert ${error ? 'error' : 'success'}`}>
          {error || success}
        </div>
      )}

      <div className="pp-card">
        <div className="pp-card-watermark" aria-hidden="true" />

        {loading ? (
          <div className="pp-loading">Loading profile...</div>
        ) : (
          <>
            <div className="pp-hero">
              <div className="pp-identity">
                <div className="pp-avatar" style={{ background: avatarColor(member.name) }}>
                  {getInitials(member.name)}
                </div>
                <div>
                  <h2 className="pp-name">{member.name}</h2>
                  <p className="pp-role-line">
                    {fmt(member.position)} {member.team ? `• ${member.team}` : '• Unassigned'}
                  </p>
                </div>
              </div>

              <div className="pp-profile-health">
                <span>Profile Completeness</span>
                <strong>{profileCompleteness}%</strong>
                <div className="pp-progress">
                  <div style={{ width: `${profileCompleteness}%` }} />
                </div>
              </div>
            </div>

            <div className="pp-summary-grid">
              <SummaryCard label="Team" value={member.team || selectedTeam?.name || 'Unassigned'} hint={selectedTeam?.division || 'Roster assignment'} />
              <SummaryCard label="Attendance" value={member.attendanceRate ? `${member.attendanceRate}%` : '—'} hint="Training attendance" />
              <SummaryCard label="Payment" value={fmt(member.payment)} hint={paymentWarning ? 'Needs attention' : 'Account status'} danger={paymentWarning} />
              <SummaryCard label="Age" value={age === null ? '—' : age} hint="Based on DOB" />
            </div>

            <div className="pp-info-grid">
              <div className="pp-info-section">
                <div className="pp-section-header">
                  <span className="pp-section-icon">👤</span>
                  <span>Personal Details</span>
                </div>
                <div className="pp-info-body">
                  <Row icon="✉" label="Email" value={fmt(member.email)} />
                  <Row icon="📞" label="Phone Number" value={fmt(member.phone)} />
                  <Row icon="🚨" label="Emergency Contact" value={fmt(member.emergencyContact)} />
                  <Row icon="📅" label="Date of Birth" value={fmtDate(member.dateOfBirth)} />
                  <Row icon="🎂" label="Age" value={age === null ? '—' : `${age} years old`} />
                </div>
              </div>

              <div className="pp-info-section">
                <div className="pp-section-header">
                  <span className="pp-section-icon">🏐</span>
                  <span>Athlete Details</span>
                </div>
                <div className="pp-info-body">
                  <Row icon="👥" label="Team" value={fmt(member.team || selectedTeam?.name)} />
                  <Row icon="🏷" label="Division" value={fmt(selectedTeam?.division)} />
                  <Row icon="📌" label="Position" value={fmt(member.position)} />
                  <Row icon="📈" label="Attendance Rate" value={member.attendanceRate ? `${member.attendanceRate}%` : '—'} />
                  <Row icon="🕒" label="Last Active" value={fmt(member.lastActive)} />
                </div>
              </div>

              <div className="pp-info-section">
                <div className="pp-section-header">
                  <span className="pp-section-icon">💳</span>
                  <span>Payment Status</span>
                </div>
                <div className="pp-info-body">
                  <Row label="Status" value={fmt(member.payment)} valueClass={`pp-payment-${safeText(member.payment).toLowerCase()}`} />
                  <Row label="Next Payment" value={fmtDate(member.nextPayment)} valueClass={paymentWarning ? 'pp-payment-overdue' : ''} />
                  <Row label="Joined" value={fmt(member.joined)} />
                  <Row label="Member ID" value={member.id ? `#${member.id}` : '—'} />
                </div>
              </div>
            </div>

            <div className="pp-card-footer">
              <button
                className="pp-stats-btn"
                onClick={() => navigate(`/player-profile/${id}/stats`, { state: { member } })}
              >
                View Performance Stats 📊
              </button>

              <button className="pp-edit-btn" onClick={() => setEditOpen(true)}>
                Edit <span>✎</span>
              </button>
            </div>
          </>
        )}
      </div>

      {editOpen && (
        <div className="pp-modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Profile</h2>

            <form onSubmit={saveEdit}>
              <div className="pp-form-section-title">Personal Details</div>
              <div className="pp-form-row">
                <FormField label="Full Name" value={f('name')} onChange={(v) => updateForm({ name: v })} type="text" required />
                <FormField label="Email" value={f('email')} onChange={(v) => updateForm({ email: v })} type="email" required />
              </div>

              <div className="pp-form-row">
                <FormField label="Phone Number" value={f('phone')} onChange={(v) => updateForm({ phone: v })} type="text" />
                <FormField label="Emergency Contact" value={f('emergencyContact')} onChange={(v) => updateForm({ emergencyContact: v })} type="text" />
              </div>

              <div className="pp-form-row">
                <FormField label="Date of Birth" value={f('dateOfBirth')} onChange={(v) => updateForm({ dateOfBirth: v })} type="date" />
              </div>

              <div className="pp-form-section-title">Athlete Details</div>
              <div className="pp-form-row">
                <div className="pp-form-group">
                  <label>Team</label>
                  <select value={f('teamId')} onChange={(e) => updateForm({ teamId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {teams.map((team) => <option key={team.id} value={String(team.id)}>{team.name}</option>)}
                  </select>
                </div>

                <div className="pp-form-group">
                  <label>Position</label>
                  <input
                    type="text"
                    list="pp-position-presets"
                    value={f('position')}
                    onChange={(e) => updateForm({ position: e.target.value })}
                  />
                  <datalist id="pp-position-presets">
                    {POSITION_PRESETS.map((position) => <option key={position} value={position} />)}
                  </datalist>
                </div>
              </div>

              <div className="pp-form-row">
                <FormField
                  label="Attendance Rate (%)"
                  value={f('attendanceRate')}
                  onChange={(v) => updateForm({ attendanceRate: v })}
                  type="number"
                  min="0"
                  max="100"
                />
              </div>

              <div className="pp-form-section-title">Payment</div>
              <div className="pp-form-row">
                <div className="pp-form-group">
                  <label>Payment Status</label>
                  <select value={f('payment')} onChange={(e) => updateForm({ payment: e.target.value })}>
                    {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>

                <FormField label="Next Payment Date" value={f('nextPayment')} onChange={(v) => updateForm({ nextPayment: v })} type="date" />
              </div>

              <div className="pp-modal-actions">
                <button type="button" className="pp-cancel-btn" onClick={() => setEditOpen(false)}>Cancel</button>
                <button type="submit" className="pp-save-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SummaryCard = ({ label, value, hint, danger }) => (
  <div className={`pp-summary-card ${danger ? 'danger' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
  </div>
);

const Row = ({ icon, label, value, valueClass }) => (
  <div className="pp-row">
    <span className="pp-row-label">
      {icon && <span className="pp-row-icon">{icon}</span>}
      {label}:
    </span>
    <span className={`pp-row-value ${valueClass || ''}`}>{value}</span>
  </div>
);

const FormField = ({ label, value, onChange, type = 'text', required = false, min, max }) => (
  <div className="pp-form-group">
    <label>{label}</label>
    <input
      type={type}
      value={value}
      required={required}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);