import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../UserContextCore';
import logo from '../assets/logo.png';
import { apiFetch, formatApiDate } from '../lib/api';
import { ROLES, normalizeRole } from '../permissions';
import './ClubManagement.css';

const AVATAR_COLORS = ['#6b7bb8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];

const POSITION_PRESETS = [
  'Setter',
  'Outside Hitter',
  'Opposite Hitter',
  'Middle Blocker',
  'Libero',
  'Defensive Specialist',
  'Coach',
  'Assistant Coach',
  'Head Coach',
];

const PAYMENT_STATUSES = ['Paid', 'Pending', 'Overdue', 'Inactive'];

const PAYMENT_STYLES = {
  Paid: { bg: '#dcfce7', color: '#15803d' },
  Inactive: { bg: '#f1f5f9', color: '#64748b' },
  Overdue: { bg: '#fee2e2', color: '#dc2626' },
  Pending: { bg: '#fef9c3', color: '#b45309' },
};

const safeText = (value) => String(value ?? '').trim();

const avatarColor = (name) => AVATAR_COLORS[(safeText(name).charCodeAt(0) || 0) % AVATAR_COLORS.length];

const getInitials = (name) => {
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

const normalizePayment = (status) => PAYMENT_STATUSES.includes(status) ? status : 'Inactive';

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : '—';
};

const isOverdueDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const PaymentBadge = ({ status }) => {
  const normalized = normalizePayment(status);
  const s = PAYMENT_STYLES[normalized] || PAYMENT_STYLES.Inactive;
  return (
    <span className="payment-badge" style={{ background: s.bg, color: s.color }}>
      {normalized}
    </span>
  );
};

const IconView = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconEdit = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconDelete = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
const IconSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IconSort = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>;
const IconChevL = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>;
const IconChevR = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>;

const EMPTY_MEMBER_FORM = {
  name: '',
  email: '',
  phone: '',
  emergencyContact: '',
  dateOfBirth: '',
  teamId: '',
  position: '',
  attendanceRate: '',
  payment: 'Paid',
  nextPayment: '',
  password: 'demo123',
};

const EMPTY_TEAM_FORM = {
  name: '',
  division: '',
  ageGroup: '',
  coachId: '',
};

export default function ClubManagement() {
  const navigate = useNavigate();
  const user = useUser();
  const normalizedRole = normalizeRole(user.role);

  const canManageTeams = normalizedRole === ROLES.MANAGER || normalizedRole === ROLES.COACH;
  const canDeleteMembers = normalizedRole === ROLES.MANAGER;
  const canEditMembers = normalizedRole === ROLES.MANAGER || normalizedRole === ROLES.COACH;

  const [activeTab, setActiveTab] = useState('Players');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [teamFilter, setTeamFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [coaches, setCoaches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modal, setModal] = useState({ open: false, mode: 'add', member: null });
  const [formData, setFormData] = useState(EMPTY_MEMBER_FORM);
  const [teamModal, setTeamModal] = useState({ open: false, mode: 'add', team: null });
  const [teamFormData, setTeamFormData] = useState(EMPTY_TEAM_FORM);

  const data = activeTab === 'Players' ? players : activeTab === 'Coaches' ? coaches : teams;

  const teamLookup = useMemo(() => {
    return teams.reduce((acc, team) => {
      acc[String(team.id)] = team;
      return acc;
    }, {});
  }, [teams]);

  const dashboardStats = useMemo(() => {
    const allMembers = [...players, ...coaches];
    const overdueCount = allMembers.filter((m) => normalizePayment(m.payment) === 'Overdue' || isOverdueDate(m.nextPayment)).length;
    const assignedPlayers = players.filter((m) => m.teamId).length;
    const averageAttendanceValues = players
      .map((m) => Number(m.attendanceRate))
      .filter((n) => Number.isFinite(n));

    const averageAttendance = averageAttendanceValues.length
      ? Math.round(averageAttendanceValues.reduce((sum, n) => sum + n, 0) / averageAttendanceValues.length)
      : null;

    return {
      players: players.length,
      coaches: coaches.length,
      teams: teams.length,
      assignedPlayers,
      overdueCount,
      averageAttendance,
    };
  }, [players, coaches, teams]);

  const uniquePositions = useMemo(() => {
    const positions = [...players, ...coaches]
      .map((m) => safeText(m.position))
      .filter(Boolean);
    return Array.from(new Set([...POSITION_PRESETS, ...positions])).sort((a, b) => a.localeCompare(b));
  }, [players, coaches]);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const filteredRows = data.filter((item) => {
      if (activeTab === 'Teams') {
        const assignedCoach = coaches.find((coach) => String(coach.id) === String(item.coachId));
        return [
          item.name,
          item.division,
          item.ageGroup,
          assignedCoach?.name,
        ].some((value) => safeText(value).toLowerCase().includes(query));
      }

      const matchesSearch = [
        item.name,
        item.email,
        item.phone,
        item.team,
        item.position,
        item.payment,
      ].some((value) => safeText(value).toLowerCase().includes(query));

      const matchesTeam = teamFilter ? String(item.teamId) === String(teamFilter) : true;
      const matchesPayment = paymentFilter ? normalizePayment(item.payment) === paymentFilter : true;
      const matchesPosition = positionFilter ? safeText(item.position) === positionFilter : true;

      return matchesSearch && matchesTeam && matchesPayment && matchesPosition;
    });

    return [...filteredRows].sort((a, b) => {
      const { key, direction } = sortConfig;
      const modifier = direction === 'asc' ? 1 : -1;

      const aValue = safeText(a[key] ?? '');
      const bValue = safeText(b[key] ?? '');

      const aNumber = Number(a[key]);
      const bNumber = Number(b[key]);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return (aNumber - bNumber) * modifier;
      }

      return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' }) * modifier;
    });
  }, [activeTab, data, searchQuery, teamFilter, paymentFilter, positionFilter, sortConfig, coaches]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const allSelected = paginated.length > 0 && paginated.every((m) => selectedRows.has(m.id));

  const clearMessagesSoon = () => {
    window.setTimeout(() => setSuccess(''), 3000);
  };

  const showSuccess = (message) => {
    setSuccess(message);
    clearMessagesSoon();
  };

  const requestSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setTeamFilter('');
    setPaymentFilter('');
    setPositionFilter('');
    setCurrentPage(1);
  };

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError('');

      const [membersData, teamsData] = await Promise.all([
        apiFetch('/api/members', { token: user.token }),
        apiFetch('/api/teams', { token: user.token }),
      ]);

      const normalizedMembers = (membersData || []).map((member) => ({
        ...member,
        payment: normalizePayment(member.payment),
        team: member.team || (member.teamId ? teamLookup[String(member.teamId)]?.name : '') || '',
      }));

      setPlayers(normalizedMembers.filter((member) => normalizeRole(member.role) === ROLES.PLAYER));
      setCoaches(normalizedMembers.filter((member) => normalizeRole(member.role) === ROLES.COACH));
      setTeams(teamsData || []);
    } catch (err) {
      setError(err.message || 'Could not load club data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.token]);

  useEffect(() => {
    setSelectedRows(new Set());
    setCurrentPage(1);
  }, [activeTab, teamFilter, paymentFilter, positionFilter, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const toggleAll = () => {
    const next = new Set(selectedRows);
    paginated.forEach((member) => {
      if (allSelected) next.delete(member.id);
      else next.add(member.id);
    });
    setSelectedRows(next);
  };

  const toggleRow = (id) => {
    const next = new Set(selectedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedRows(next);
  };

  const openAdd = () => {
    if (activeTab === 'Teams') {
      setTeamFormData(EMPTY_TEAM_FORM);
      setTeamModal({ open: true, mode: 'add', team: null });
      return;
    }

    setFormData({
      ...EMPTY_MEMBER_FORM,
      position: activeTab === 'Coaches' ? 'Coach' : '',
    });
    setModal({ open: true, mode: 'add', member: null });
  };

  const openEdit = (member) => {
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      emergencyContact: member.emergencyContact || '',
      dateOfBirth: formatApiDate(member.dateOfBirth || ''),
      teamId: member.teamId ? String(member.teamId) : '',
      position: member.position || '',
      attendanceRate: member.attendanceRate ?? '',
      payment: normalizePayment(member.payment),
      nextPayment: formatApiDate(member.nextPayment || ''),
      password: '',
    });
    setModal({ open: true, mode: 'edit', member });
  };

  const openTeamEdit = (team) => {
    setTeamFormData({
      name: team.name || '',
      division: team.division || '',
      ageGroup: team.ageGroup || '',
      coachId: team.coachId ? String(team.coachId) : '',
    });
    setTeamModal({ open: true, mode: 'edit', team });
  };

  const viewProfile = (member) => {
    navigate(`/player-profile/${member.id}`, { state: { member } });
  };

  const saveModal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const role = activeTab === 'Players' ? ROLES.PLAYER : ROLES.COACH;
    const payload = {
      ...formData,
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      role,
      teamId: formData.teamId ? Number(formData.teamId) : null,
      attendanceRate: formData.attendanceRate === '' ? null : Number(formData.attendanceRate),
      payment: normalizePayment(formData.payment),
    };

    if (!payload.password) delete payload.password;

    try {
      if (modal.mode === 'add') {
        await apiFetch('/api/members', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify(payload),
        });
        showSuccess(`${activeTab === 'Players' ? 'Player' : 'Coach'} added successfully.`);
      } else {
        await apiFetch(`/api/members/${modal.member.id}`, {
          method: 'PUT',
          token: user.token,
          body: JSON.stringify(payload),
        });
        showSuccess('Member updated successfully.');
      }

      await loadMembers();
      setModal({ open: false, mode: 'add', member: null });
    } catch (err) {
      setError(err.message || 'Could not save member.');
    } finally {
      setSaving(false);
    }
  };

  const saveTeamModal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...teamFormData,
      name: teamFormData.name.trim(),
      division: teamFormData.division.trim(),
      ageGroup: teamFormData.ageGroup.trim(),
      coachId: teamFormData.coachId ? Number(teamFormData.coachId) : null,
    };

    try {
      if (teamModal.mode === 'add') {
        await apiFetch('/api/teams', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify(payload),
        });
        showSuccess('Team added successfully.');
      } else {
        await apiFetch(`/api/teams/${teamModal.team.id}`, {
          method: 'PUT',
          token: user.token,
          body: JSON.stringify(payload),
        });
        showSuccess('Team updated successfully.');
      }

      await loadMembers();
      setTeamModal({ open: false, mode: 'add', team: null });
      setTeamFormData(EMPTY_TEAM_FORM);
    } catch (err) {
      setError(err.message || 'Could not save team.');
    } finally {
      setSaving(false);
    }
  };

  const assignCoachToTeam = async (teamId, coachId) => {
    if (!canManageTeams) return;

    try {
      setError('');
      await apiFetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        token: user.token,
        body: JSON.stringify({ coachId: coachId ? Number(coachId) : null }),
      });
      await loadMembers();
      showSuccess('Coach assignment updated.');
    } catch (err) {
      setError(err.message || 'Could not assign coach.');
    }
  };

  const deleteMember = async (id, name) => {
    if (!canDeleteMembers) {
      setError('Only managers can delete members.');
      return;
    }

    const confirmed = window.confirm(`Delete ${name || 'this member'}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setError('');
      await apiFetch(`/api/members/${id}`, { method: 'DELETE', token: user.token });
      await loadMembers();
      setSelectedRows((rows) => {
        const next = new Set(rows);
        next.delete(id);
        return next;
      });
      showSuccess('Member deleted.');
    } catch (err) {
      setError(err.message || 'Could not delete member.');
    }
  };

  const bulkDelete = async () => {
    if (!canDeleteMembers) {
      setError('Only managers can delete members.');
      return;
    }

    const ids = Array.from(selectedRows);
    if (!ids.length) return;

    const confirmed = window.confirm(`Delete ${ids.length} selected member${ids.length === 1 ? '' : 's'}?`);
    if (!confirmed) return;

    try {
      setError('');
      await Promise.all(ids.map((id) => apiFetch(`/api/members/${id}`, { method: 'DELETE', token: user.token })));
      setSelectedRows(new Set());
      await loadMembers();
      showSuccess('Selected members deleted.');
    } catch (err) {
      setError(err.message || 'Could not delete selected members.');
    }
  };

  const pageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages = [1];
    if (currentPage > 3) pages.push('…');

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i += 1) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  };

  const userInitials = getInitials(user.name);

  const tableColSpan = activeTab === 'Teams' ? 6 : 10;

  return (
    <div className="cm-container">
      <div className="cm-bg-pattern" aria-hidden="true" />

      <header className="cm-topbar">
        <div className="cm-topbar-left">
          <img src={logo} alt="VolleyOps" className="cm-header-logo" />
          <div>
            <h1 className="cm-title">CLUB MANAGEMENT</h1>
            <p className="cm-subtitle">Manage players, coaches, teams, profiles, and payment readiness.</p>
          </div>
        </div>

        <div className="cm-topbar-right">
          <div className="cm-user-chip">
            <div className="cm-user-avatar">{userInitials}</div>
            <span>{user.name}</span>
          </div>
          <button className="cm-back-btn" onClick={() => navigate('/')}>Back <span>&larr;</span></button>
        </div>
      </header>

      <section className="cm-dashboard">
        <div className="cm-stat-card">
          <span className="cm-stat-label">Players</span>
          <strong>{dashboardStats.players}</strong>
          <small>{dashboardStats.assignedPlayers} assigned to teams</small>
        </div>
        <div className="cm-stat-card">
          <span className="cm-stat-label">Coaches</span>
          <strong>{dashboardStats.coaches}</strong>
          <small>{teams.filter((team) => team.coachId).length} assigned teams</small>
        </div>
        <div className="cm-stat-card">
          <span className="cm-stat-label">Teams</span>
          <strong>{dashboardStats.teams}</strong>
          <small>Filter roster by team</small>
        </div>
        <div className="cm-stat-card warning">
          <span className="cm-stat-label">Payment Alerts</span>
          <strong>{dashboardStats.overdueCount}</strong>
          <small>Overdue or past due</small>
        </div>
        <div className="cm-stat-card">
          <span className="cm-stat-label">Avg Attendance</span>
          <strong>{dashboardStats.averageAttendance === null ? '—' : `${dashboardStats.averageAttendance}%`}</strong>
          <small>Players only</small>
        </div>
      </section>

      {(error || success) && (
        <div className={`cm-alert ${error ? 'error' : 'success'}`}>
          {error || success}
        </div>
      )}

      <div className="cm-toolbar">
        <div className="cm-toolbar-left">
          <div className="cm-search-wrap">
            <input
              className="cm-search"
              placeholder={`Search ${activeTab.toLowerCase()} by name, email, team, position...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="cm-search-btn" type="button" aria-label="Search">
              <IconSearch />
            </button>
          </div>

          {activeTab !== 'Teams' && (
            <>
              <div className="cm-filter">
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                  <option value="">All Teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div className="cm-filter">
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                  <option value="">All Payments</option>
                  {PAYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="cm-filter">
                <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
                  <option value="">All Positions</option>
                  {uniquePositions.map((position) => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(searchQuery || teamFilter || paymentFilter || positionFilter) && (
            <button className="cm-clear-btn" type="button" onClick={resetFilters}>
              Clear Filters
            </button>
          )}
        </div>

        <div className="cm-toolbar-right">
          {selectedRows.size > 0 && activeTab !== 'Teams' && canDeleteMembers && (
            <button className="cm-danger-btn" onClick={bulkDelete}>
              Delete Selected ({selectedRows.size})
            </button>
          )}

          {canManageTeams && (
            <button className="cm-add-btn secondary" onClick={() => {
              setTeamFormData(EMPTY_TEAM_FORM);
              setTeamModal({ open: true, mode: 'add', team: null });
            }}>
              + Add Team
            </button>
          )}

          {canEditMembers && (
            <button className="cm-add-btn" onClick={openAdd}>
              + Add {activeTab === 'Teams' ? 'Team' : activeTab === 'Players' ? 'Player' : 'Coach'}
            </button>
          )}
        </div>
      </div>

      <div className="cm-card">
        <div className="cm-tabs">
          {['Players', 'Coaches', 'Teams'].map((tab) => (
            <button
              key={tab}
              className={`cm-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab);
                setCurrentPage(1);
                setSelectedRows(new Set());
                setSortConfig({ key: tab === 'Teams' ? 'name' : 'name', direction: 'asc' });
              }}
            >
              {tab}
              <span className="cm-tab-count">
                {tab === 'Players' ? players.length : tab === 'Coaches' ? coaches.length : teams.length}
              </span>
            </button>
          ))}
        </div>

        <div className="cm-table-wrapper">
          <table className="cm-table">
            <thead>
              {activeTab === 'Teams' ? (
                <tr>
                  <th onClick={() => requestSort('name')}>Team Name <IconSort /></th>
                  <th onClick={() => requestSort('division')}>Division <IconSort /></th>
                  <th onClick={() => requestSort('ageGroup')}>Age Group <IconSort /></th>
                  <th>Players</th>
                  <th>Assigned Coach</th>
                  <th>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th className="cm-th-check">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all visible rows" />
                  </th>
                  <th onClick={() => requestSort('name')}>Full Name <IconSort /></th>
                  <th onClick={() => requestSort('email')}>Email <IconSort /></th>
                  <th onClick={() => requestSort('team')}>Team <IconSort /></th>
                  <th onClick={() => requestSort('payment')}>Payment <IconSort /></th>
                  <th onClick={() => requestSort('position')}>Position <IconSort /></th>
                  <th onClick={() => requestSort('attendanceRate')}>Attendance <IconSort /></th>
                  <th onClick={() => requestSort('joined')}>Joined <IconSort /></th>
                  <th onClick={() => requestSort('lastActive')}>Last Active <IconSort /></th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColSpan} className="cm-empty">Loading club data...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="cm-empty">
                    {searchQuery || teamFilter || paymentFilter || positionFilter
                      ? `No ${activeTab.toLowerCase()} match your current filters.`
                      : `No ${activeTab.toLowerCase()} yet.`}
                  </td>
                </tr>
              ) : activeTab === 'Teams' ? (
                paginated.map((team) => {
                  const assignedCoach = coaches.find((coach) => String(coach.id) === String(team.coachId));
                  const playerCount = players.filter((player) => String(player.teamId) === String(team.id)).length;

                  return (
                    <tr key={team.id}>
                      <td>
                        <strong>{team.name}</strong>
                        <div className="cm-row-subtitle">Team ID #{team.id}</div>
                      </td>
                      <td>{team.division || '—'}</td>
                      <td>{team.ageGroup || '—'}</td>
                      <td>
                        <span className="cm-count-pill">{playerCount} player{playerCount === 1 ? '' : 's'}</span>
                      </td>
                      <td>
                        <select
                          className="cm-coach-select"
                          value={team.coachId || ''}
                          onChange={(e) => assignCoachToTeam(team.id, e.target.value)}
                          disabled={!canManageTeams}
                          title={!canManageTeams ? 'Only managers/coaches can assign coaches' : ''}
                        >
                          <option value="">Unassigned</option>
                          {coaches.map((coach) => (
                            <option key={coach.id} value={coach.id}>{coach.name}</option>
                          ))}
                        </select>
                        {assignedCoach && <div className="cm-row-subtitle">{assignedCoach.email}</div>}
                      </td>
                      <td>
                        <div className="cm-actions">
                          <button className="cm-action-btn edit" title="Edit team" onClick={() => openTeamEdit(team)}>
                            <IconEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                paginated.map((member) => (
                  <tr key={member.id} className={selectedRows.has(member.id) ? 'selected' : ''}>
                    <td className="cm-td-check">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(member.id)}
                        onChange={() => toggleRow(member.id)}
                        aria-label={`Select ${member.name}`}
                      />
                    </td>
                    <td>
                      <button className="cm-name-cell as-button" onClick={() => viewProfile(member)}>
                        <div className="cm-avatar" style={{ background: avatarColor(member.name) }}>{getInitials(member.name)}</div>
                        <span>
                          {member.name}
                          <small>Open profile</small>
                        </span>
                      </button>
                    </td>
                    <td className="cm-muted">{member.email || '—'}</td>
                    <td>
                      {member.team || 'Unassigned'}
                      {!member.team && <div className="cm-row-subtitle">Needs team</div>}
                    </td>
                    <td>
                      <PaymentBadge status={member.payment} />
                      {isOverdueDate(member.nextPayment) && <div className="cm-row-subtitle danger">Past due</div>}
                    </td>
                    <td>{member.position || '—'}</td>
                    <td>{formatPercent(member.attendanceRate)}</td>
                    <td className="cm-muted">{member.joined || '—'}</td>
                    <td className="cm-muted">{member.lastActive || '—'}</td>
                    <td>
                      <div className="cm-actions">
                        <button className="cm-action-btn view" title="View profile" onClick={() => viewProfile(member)}>
                          <IconView />
                        </button>
                        {canEditMembers && (
                          <button className="cm-action-btn edit" title="Edit" onClick={() => openEdit(member)}>
                            <IconEdit />
                          </button>
                        )}
                        {canDeleteMembers && (
                          <button className="cm-action-btn delete" title="Delete" onClick={() => deleteMember(member.id, member.name)}>
                            <IconDelete />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cm-pagination">
          <div className="cm-rows-per-page">
            Rows per page
            <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="cm-total-label">of {filtered.length} rows</span>
          </div>

          <div className="cm-page-controls">
            <button className="cm-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}><IconChevL /></button>
            {pageNumbers().map((p, i) => (
              p === '…'
                ? <span key={`ellipsis-${i}`} className="cm-page-ellipsis">…</span>
                : <button key={p} className={`cm-page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
            ))}
            <button className="cm-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}><IconChevR /></button>
          </div>
        </div>
      </div>

      {modal.open && (
        <div className="cm-modal-overlay" onClick={() => setModal({ open: false, mode: 'add', member: null })}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.mode === 'add' ? `Add New ${activeTab === 'Players' ? 'Player' : 'Coach'}` : 'Edit Member'}</h2>

            <form onSubmit={saveModal}>
              <div className="cm-modal-section-title">Personal Details</div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="cm-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jane@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {modal.mode === 'add' && (
                <div className="cm-form-row">
                  <div className="cm-form-group">
                    <label>Temporary Password</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div className="cm-form-note">
                    Default password is <strong>demo123</strong>. Change it if your demo requires a custom login.
                  </div>
                </div>
              )}

              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="+961 XX XXX XXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="cm-form-group">
                  <label>Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="+961 XX XXX XXX"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  />
                </div>
              </div>

              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="cm-form-group">
                  <label>Team</label>
                  <select value={formData.teamId} onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="cm-modal-section-title">Athlete / Staff Details</div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Position</label>
                  <input
                    type="text"
                    list="position-presets"
                    placeholder="e.g. Setter"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                  <datalist id="position-presets">
                    {POSITION_PRESETS.map((position) => <option key={position} value={position} />)}
                  </datalist>
                </div>
                <div className="cm-form-group">
                  <label>Attendance Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 95"
                    value={formData.attendanceRate}
                    onChange={(e) => setFormData({ ...formData, attendanceRate: e.target.value })}
                  />
                </div>
              </div>

              <div className="cm-modal-section-title">Payment Status</div>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Payment Status</label>
                  <select value={formData.payment} onChange={(e) => setFormData({ ...formData, payment: e.target.value })}>
                    {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div className="cm-form-group">
                  <label>Next Payment Date</label>
                  <input
                    type="date"
                    value={formData.nextPayment}
                    onChange={(e) => setFormData({ ...formData, nextPayment: e.target.value })}
                  />
                </div>
              </div>

              <div className="cm-modal-actions">
                <button type="button" className="cm-cancel-btn" onClick={() => setModal({ open: false, mode: 'add', member: null })}>Cancel</button>
                <button type="submit" className="cm-save-btn" disabled={saving}>
                  {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Member' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {teamModal.open && (
        <div className="cm-modal-overlay" onClick={() => setTeamModal({ open: false, mode: 'add', team: null })}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{teamModal.mode === 'add' ? 'Add New Team' : 'Edit Team'}</h2>

            <form onSubmit={saveTeamModal}>
              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Team Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U16 A"
                    value={teamFormData.name}
                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                  />
                </div>
                <div className="cm-form-group">
                  <label>Division</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Varsity"
                    value={teamFormData.division}
                    onChange={(e) => setTeamFormData({ ...teamFormData, division: e.target.value })}
                  />
                </div>
              </div>

              <div className="cm-form-row">
                <div className="cm-form-group">
                  <label>Age Group</label>
                  <input
                    type="text"
                    placeholder="e.g. U16"
                    value={teamFormData.ageGroup}
                    onChange={(e) => setTeamFormData({ ...teamFormData, ageGroup: e.target.value })}
                  />
                </div>
                <div className="cm-form-group">
                  <label>Assigned Coach</label>
                  <select value={teamFormData.coachId} onChange={(e) => setTeamFormData({ ...teamFormData, coachId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="cm-modal-actions">
                <button type="button" className="cm-cancel-btn" onClick={() => setTeamModal({ open: false, mode: 'add', team: null })}>Cancel</button>
                <button type="submit" className="cm-save-btn" disabled={saving}>
                  {saving ? 'Saving...' : teamModal.mode === 'add' ? 'Add Team' : 'Save Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}