import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContextCore';
import logo from '../assets/logo.png';
import { apiFetch, formatApiDate } from '../lib/api';
import './ClubManagement.css';

// ── No hardcoded initial data — lists start empty ─────────────────────────────
const AVATAR_COLORS = ['#6b7bb8','#22c55e','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6'];
const avatarColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const PAYMENT_STYLES = {
  Paid:     { bg: '#dcfce7', color: '#15803d' },
  Inactive: { bg: '#f1f5f9', color: '#64748b' },
  Overdue:  { bg: '#fee2e2', color: '#dc2626' },
  Pending:  { bg: '#fef9c3', color: '#b45309' },
};
const PaymentBadge = ({ status }) => {
  const s = PAYMENT_STYLES[status] || PAYMENT_STYLES['Inactive'];
  return <span className="payment-badge" style={{ background: s.bg, color: s.color }}>{status}</span>;
};

const IconView   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEdit   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconDelete = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconSort   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>;
const IconChevL  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>;
const IconChevR  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>;

export default function ClubManagement() {
  const navigate = useNavigate();
  const user     = useUser();

  const [activeTab,    setActiveTab]    = useState('Players');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [rowsPerPage,  setRowsPerPage]  = useState(10);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modal,    setModal]    = useState({ open: false, mode: 'add', member: null });
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', emergencyContact: '',
    dateOfBirth: '', teamId: '', position: '', attendanceRate: '',
    payment: 'Paid', nextPayment: '',
  });

  // ── Data starts empty ─────────────────────────────────────────────────────
  const [players, setPlayers] = useState([]);
  const [coaches, setCoaches] = useState([]);

  const data    = activeTab === 'Players' ? players : coaches;

  const filtered = useMemo(() =>
    data.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.team || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [data, searchQuery]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated  = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const allSelected = paginated.length > 0 && paginated.every(m => selectedRows.has(m.id));
  const toggleAll   = () => { const n = new Set(selectedRows); paginated.forEach(m => allSelected ? n.delete(m.id) : n.add(m.id)); setSelectedRows(n); };
  const toggleRow   = (id) => { const n = new Set(selectedRows); n.has(id) ? n.delete(id) : n.add(id); setSelectedRows(n); };

  const loadMembers = async () => {
    try {
      setLoading(true);
      const [membersData, teamsData] = await Promise.all([
        apiFetch('/api/members'),
        apiFetch('/api/teams'),
      ]);
      setPlayers((membersData || []).filter(member => member.role === 'ATHLETE'));
      setCoaches((membersData || []).filter(member => member.role === 'COACH'));
      setTeams(teamsData || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const openAdd  = () => {
    setFormData({ name:'', email:'', phone:'', emergencyContact:'', dateOfBirth:'', teamId:'', position:'', attendanceRate:'', payment:'Paid', nextPayment:'' });
    setModal({ open: true, mode: 'add', member: null });
  };
  const openEdit = (m) => {
    setFormData({ name: m.name, email: m.email, phone: m.phone || '', emergencyContact: m.emergencyContact || '', dateOfBirth: formatApiDate(m.dateOfBirth || ''), teamId: m.teamId ? String(m.teamId) : '', position: m.position, attendanceRate: m.attendanceRate || '', payment: m.payment, nextPayment: formatApiDate(m.nextPayment || '') });
    setModal({ open: true, mode: 'edit', member: m });
  };
  const deleteMember = async (id) => {
    try {
      await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveModal = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      role: activeTab === 'Players' ? 'ATHLETE' : 'COACH',
      teamId: formData.teamId ? Number(formData.teamId) : null,
    };
    try {
      if (modal.mode === 'add') {
        await apiFetch('/api/members', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/members/${modal.member.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      await loadMembers();
      setModal({ open: false, mode: 'add', member: null });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Eye icon — navigate to player profile page ────────────────────────────
  const viewProfile = (member) => {
    navigate(`/player-profile/${member.id}`, { state: { member } });
  };

  const pageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push('…');
    for (let i = Math.max(2, currentPage-1); i <= Math.min(totalPages-1, currentPage+1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  const userInitials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="cm-container">
      <div className="cm-bg-pattern" aria-hidden="true" />

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="cm-topbar">
        {/* Logo + title */}
        <div className="cm-topbar-left">
          <img src={logo} alt="VolleyOps" className="cm-header-logo" />
          <h1 className="cm-title">CLUB MANAGEMENT</h1>
        </div>
        <div className="cm-topbar-right">
          <div className="cm-user-chip">
            <div className="cm-user-avatar">{userInitials}</div>
            <span>{user.name}</span>
          </div>
          <button className="cm-back-btn" onClick={() => navigate('/')}>Back <span>&larr;</span></button>
        </div>
      </header>

      {/* ── Search + Add ─────────────────────────────────────────────── */}
      <div className="cm-toolbar">
        <div className="cm-search-wrap">
          <input className="cm-search" placeholder="Search for players or coaches"
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
          <button className="cm-search-btn"><IconSearch /></button>
        </div>
        <button className="cm-add-btn" onClick={openAdd}>+ Add Member</button>
      </div>

      {/* ── Table card ───────────────────────────────────────────────── */}
      <div className="cm-card">
        <div className="cm-tabs">
          {['Players', 'Coaches'].map(tab => (
            <button key={tab} className={`cm-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); setSelectedRows(new Set()); }}>
              {tab}
            </button>
          ))}
        </div>

        <div className="cm-table-wrapper">
          {error && <p className="cm-empty">{error}</p>}
          <table className="cm-table">
            <thead>
              <tr>
                <th className="cm-th-check"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th>Full Name <IconSort /></th>
                <th>Email <IconSort /></th>
                <th>Team <IconSort /></th>
                <th>Payment <IconSort /></th>
                <th>Position <IconSort /></th>
                <th>Joined Date <IconSort /></th>
                <th>Last Active <IconSort /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="cm-empty">Loading members...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="cm-empty">
                    {searchQuery ? 'No members match your search.' : `No ${activeTab.toLowerCase()} yet. Click "+ Add Member" to get started.`}
                  </td>
                </tr>
              ) : paginated.map(member => (
                <tr key={member.id} className={selectedRows.has(member.id) ? 'selected' : ''}>
                  <td className="cm-td-check"><input type="checkbox" checked={selectedRows.has(member.id)} onChange={() => toggleRow(member.id)} /></td>
                  <td>
                    <div className="cm-name-cell">
                      <div className="cm-avatar" style={{ background: avatarColor(member.name) }}>{getInitials(member.name)}</div>
                      <span>{member.name}</span>
                    </div>
                  </td>
                  <td className="cm-muted">{member.email}</td>
                  <td>{member.team}</td>
                  <td><PaymentBadge status={member.payment} /></td>
                  <td>{member.position}</td>
                  <td className="cm-muted">{member.joined}</td>
                  <td className="cm-muted">{member.lastActive}</td>
                  <td>
                    <div className="cm-actions">
                      {/* View → player profile page */}
                      <button className="cm-action-btn view"   title="View profile" onClick={() => viewProfile(member)}><IconView /></button>
                      <button className="cm-action-btn edit"   title="Edit"         onClick={() => openEdit(member)}>  <IconEdit /></button>
                      <button className="cm-action-btn delete" title="Delete"       onClick={() => deleteMember(member.id)}><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="cm-pagination">
          <div className="cm-rows-per-page">
            Rows per page
            <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="cm-total-label">of {filtered.length} rows</span>
          </div>
          <div className="cm-page-controls">
            <button className="cm-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p-1)}><IconChevL /></button>
            {pageNumbers().map((p, i) =>
              p === '…'
                ? <span key={`e${i}`} className="cm-page-ellipsis">…</span>
                : <button key={p} className={`cm-page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
            )}
            <button className="cm-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p+1)}><IconChevR /></button>
          </div>
        </div>
      </div>

      {/* ── Add / Edit modal — rendered at root level, outside cm-card ──── */}
      {modal.open && (
        <div className="cm-modal-overlay" onClick={() => setModal({ open: false })}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>
            <h2>{modal.mode === 'add' ? `Add New ${activeTab === 'Players' ? 'Player' : 'Coach'}` : 'Edit Member'}</h2>
            <form onSubmit={saveModal}>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Full Name</label>
                  <input type="text" required placeholder="e.g. Jane Doe"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="cm-form-group">
                  <label>Email</label>
                  <input type="email" required placeholder="e.g. jane@example.com"
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Phone Number</label>
                  <input type="text" placeholder="+961 XX XXX XXX"
                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="cm-form-group">
                  <label>Emergency Contact</label>
                  <input type="text" placeholder="+961 XX XXX XXX"
                    value={formData.emergencyContact} onChange={e => setFormData({...formData, emergencyContact: e.target.value})} />
                </div>
              </div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Date of Birth</label>
                  <input type="date"
                    value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} />
                </div>
                <div className="cm-form-group">
                  <label>Team</label>
                  <select
                    value={formData.teamId}
                    onChange={e => setFormData({...formData, teamId: e.target.value})}
                  >
                    <option value="">Select a team</option>
                    {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Position</label>
                  <input type="text" placeholder="e.g. Setter"
                    value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} />
                </div>
                <div className="cm-form-group">
                  <label>Attendance Rate (%)</label>
                  <input type="number" min="0" max="100" placeholder="e.g. 95"
                    value={formData.attendanceRate} onChange={e => setFormData({...formData, attendanceRate: e.target.value})} />
                </div>
              </div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Payment Status</label>
                  <select value={formData.payment} onChange={e => setFormData({...formData, payment: e.target.value})}>
                    {['Paid','Pending','Overdue','Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="cm-form-group">
                  <label>Next Payment Date</label>
                  <input type="date"
                    value={formData.nextPayment} onChange={e => setFormData({...formData, nextPayment: e.target.value})} />
                </div>
              </div>
              <div className="cm-modal-actions">
                <button type="button" className="cm-cancel-btn" onClick={() => setModal({ open: false })}>Cancel</button>
                <button type="submit" className="cm-save-btn">{modal.mode === 'add' ? 'Add Member' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
