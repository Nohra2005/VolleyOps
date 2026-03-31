import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch, formatApiDate } from '../lib/api';
import './PlayerProfile.css';

const AVATAR_COLORS = ['#6b7bb8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];
const avatarColor = (name) => AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = '') => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

const fmt = (val) => val || '—';

const fmtDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return val;
  }
};

export default function PlayerProfile() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id } = useParams();

  const [member, setMember] = useState(state?.member || {
    id: null,
    name: 'Unknown Member',
    email: '—',
    phone: '—',
    emergencyContact: '—',
    dateOfBirth: '',
    team: '—',
    teamId: '',
    position: '—',
    attendanceRate: '',
    payment: '—',
    nextPayment: '',
  });
  const [teams, setTeams] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ ...member });
  const [loading, setLoading] = useState(!state?.member);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      ...member,
      dateOfBirth: formatApiDate(member.dateOfBirth || ''),
      nextPayment: formatApiDate(member.nextPayment || ''),
      teamId: member.teamId ? String(member.teamId) : '',
    });
  }, [member]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const [memberData, teamsData] = await Promise.all([
          apiFetch(`/api/members/${id}`),
          apiFetch('/api/teams'),
        ]);
        setMember(memberData);
        setTeams(teamsData || []);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id]);

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const updated = await apiFetch(`/api/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          teamId: form.teamId ? Number(form.teamId) : null,
        }),
      });
      setMember(updated);
      setEditOpen(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const f = (key) => form[key] ?? '';

  return (
    <div className="pp-container">
      <div className="pp-bg-pattern" aria-hidden="true" />

      <header className="pp-header">
        <div className="pp-header-left">
          <img src={logo} alt="VolleyOps" className="pp-logo" />
          <h1 className="pp-title">PLAYER PROFILE</h1>
        </div>
        <button className="pp-back-btn" onClick={() => navigate(-1)}>Back <span>&larr;</span></button>
      </header>

      <div className="pp-card">
        {loading && <p>Loading profile...</p>}
        {error && <p>{error}</p>}
        <div className="pp-card-watermark" aria-hidden="true" />

        <div className="pp-identity">
          <div className="pp-avatar" style={{ background: avatarColor(member.name) }}>
            {getInitials(member.name)}
          </div>
          <h2 className="pp-name">{member.name}</h2>
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
              <Row icon="📞" label="Emergency Contact" value={fmt(member.emergencyContact)} />
              <Row icon="📅" label="Date of Birth" value={fmtDate(member.dateOfBirth)} />
            </div>
          </div>

          <div className="pp-info-section">
            <div className="pp-section-header">
              <span className="pp-section-icon">🏐</span>
              <span>Athlete Details</span>
            </div>
            <div className="pp-info-body">
              <Row icon="👥" label="Team" value={fmt(member.team)} />
              <Row label="Position" value={fmt(member.position)} />
              <Row label="Attendance Rate" value={member.attendanceRate ? `${member.attendanceRate}%` : '—'} />
            </div>
          </div>

          <div className="pp-info-section">
            <div className="pp-section-header">
              <span className="pp-section-icon">💳</span>
              <span>Payment Status</span>
            </div>
            <div className="pp-info-body">
              <Row label="Status" value={fmt(member.payment)} valueClass={`pp-payment-${(member.payment || '').toLowerCase()}`} />
              <Row label="Next Payment" value={fmtDate(member.nextPayment)} />
            </div>
          </div>
        </div>

        <div className="pp-card-footer">
          <button className="pp-edit-btn" onClick={() => setEditOpen(true)}>
            Edit <span>✎</span>
          </button>
        </div>
      </div>

      {editOpen && (
        <div className="pp-modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Profile</h2>
            <form onSubmit={saveEdit}>
              <div className="pp-form-section-title">Personal Details</div>
              <div className="pp-form-row">
                <FormField label="Full Name" value={f('name')} onChange={(v) => setForm({ ...form, name: v })} type="text" />
                <FormField label="Email" value={f('email')} onChange={(v) => setForm({ ...form, email: v })} type="email" />
              </div>
              <div className="pp-form-row">
                <FormField label="Phone Number" value={f('phone')} onChange={(v) => setForm({ ...form, phone: v })} type="text" />
                <FormField label="Emergency Contact" value={f('emergencyContact')} onChange={(v) => setForm({ ...form, emergencyContact: v })} type="text" />
              </div>
              <div className="pp-form-row">
                <FormField label="Date of Birth" value={f('dateOfBirth')} onChange={(v) => setForm({ ...form, dateOfBirth: v })} type="date" />
              </div>

              <div className="pp-form-section-title" style={{ marginTop: 16 }}>Athlete Details</div>
              <div className="pp-form-row">
                <div className="pp-form-group">
                  <label>Team</label>
                  <select value={f('teamId')} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                    <option value="">Select team</option>
                    {teams.map((team) => <option key={team.id} value={String(team.id)}>{team.name}</option>)}
                  </select>
                </div>
                <FormField label="Position" value={f('position')} onChange={(v) => setForm({ ...form, position: v })} type="text" />
              </div>
              <div className="pp-form-row">
                <FormField label="Attendance Rate (%)" value={f('attendanceRate')} onChange={(v) => setForm({ ...form, attendanceRate: v })} type="number" />
              </div>

              <div className="pp-form-section-title" style={{ marginTop: 16 }}>Payment</div>
              <div className="pp-form-row">
                <div className="pp-form-group">
                  <label>Payment Status</label>
                  <select value={f('payment')} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
                    {['Paid', 'Pending', 'Overdue', 'Inactive'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <FormField label="Next Payment Date" value={f('nextPayment')} onChange={(v) => setForm({ ...form, nextPayment: v })} type="date" />
              </div>

              <div className="pp-modal-actions">
                <button type="button" className="pp-cancel-btn" onClick={() => setEditOpen(false)}>Cancel</button>
                <button type="submit" className="pp-save-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ icon, label, value, valueClass }) => (
  <div className="pp-row">
    <span className="pp-row-label">
      {icon && <span className="pp-row-icon">{icon}</span>}
      {label}:
    </span>
    <span className={`pp-row-value ${valueClass || ''}`}>{value}</span>
  </div>
);

const FormField = ({ label, value, onChange, type = 'text' }) => (
  <div className="pp-form-group">
    <label>{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);
