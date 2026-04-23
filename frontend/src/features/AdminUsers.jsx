import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useUser } from '../UserContextCore';
import { apiFetch } from '../lib/api';
import { ROLES, canManageUsers, normalizeRole } from '../permissions';
import './AdminUsers.css';

const ASSIGNABLE_ROLES = [ROLES.MANAGER, ROLES.COACH, ROLES.PLAYER];

const roleLabel = (role) => role.charAt(0) + role.slice(1).toLowerCase();

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function AdminUsers() {
  const navigate = useNavigate();
  const user = useUser();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const isManager = canManageUsers(user.role);
  
  // STRICT RBAC CHECK: Ensure the user is exactly a MANAGER
  const isStrictlyManager = normalizeRole(user.role) === ROLES.MANAGER;

  const filteredUsers = useMemo(
    () =>
      users.filter((item) =>
        [item.name, item.email, item.role, item.team]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [users, search]
  );

  const loadUsers = useCallback(async () => {
    if (!isManager || !user.token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await apiFetch('/api/auth/users', { token: user.token });
      setUsers(data || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isManager, user.token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateRole = async (targetUser, role) => {
    try {
      setSavingId(targetUser.id);
      const updatedUser = await apiFetch(`/api/auth/users/${targetUser.id}/role`, {
        method: 'PUT',
        token: user.token,
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
      if (updatedUser.id === user.id) {
        user.login({ token: user.token, user: updatedUser });
      }
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (targetUser) => {
    // Frontend RBAC verification
    if (!isStrictlyManager) {
      setError("Access Denied: Only managers have permission to delete users.");
      return;
    }

    if (targetUser.id === user.id) {
      setError("You cannot delete your own account.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${targetUser.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(targetUser.id);
      
      await apiFetch(`/api/members/${targetUser.id}`, {
        method: 'DELETE',
        token: user.token,
      });
      
      setUsers((current) => current.filter((item) => item.id !== targetUser.id));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-users-container">
      <div className="admin-users-bg" aria-hidden="true" />

      <header className="admin-users-topbar">
        <div className="admin-users-topbar-left">
          <img src={logo} alt="VolleyOps" className="admin-users-logo" />
          <h1>USERS</h1>
        </div>
        <div className="admin-users-topbar-right">
          <div className="admin-users-chip">
            <span>{user.initials}</span>
            {user.name}
          </div>
          <button type="button" onClick={() => navigate('/')}>Back</button>
        </div>
      </header>

      {!isManager ? (
        <section className="admin-users-locked">
          <h2>Manager access required</h2>
          <p>Only managers can manage user roles.</p>
          <button type="button" onClick={() => navigate('/')}>Return home</button>
        </section>
      ) : (
        <>
          <div className="admin-users-toolbar">
            <div>
              <p>Role Control</p>
              <h2>Assign manager, coach, and player access.</h2>
            </div>
            <input
              type="search"
              placeholder="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <section className="admin-users-card">
            {error && <p className="admin-users-error">{error}</p>}
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Team</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="admin-users-empty">Loading users...</td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-users-empty">No users found.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="admin-users-person">
                            <span>{initials(item.name)}</span>
                            <strong>{item.name}</strong>
                          </div>
                        </td>
                        <td>{item.email}</td>
                        <td>{item.team || 'No team'}</td>
                        <td><span className={`admin-users-role role-${normalizeRole(item.role).toLowerCase()}`}>{roleLabel(normalizeRole(item.role))}</span></td>
                        <td>
                          <div className="admin-users-actions">
                            <select
                              value={normalizeRole(item.role)}
                              disabled={savingId === item.id || deletingId === item.id}
                              onChange={(event) => updateRole(item, event.target.value)}
                            >
                              {ASSIGNABLE_ROLES.map((role) => (
                                <option key={role} value={role}>{roleLabel(role)}</option>
                              ))}
                            </select>

                            {/* Only render the delete button if the active user is a MANAGER */}
                            {isStrictlyManager && (
                              <button
                                type="button"
                                className="delete-user-btn"
                                onClick={() => deleteUser(item)}
                                disabled={deletingId === item.id || savingId === item.id}
                                title={`Delete ${item.name}`}
                              >
                                {deletingId === item.id ? '...' : '🗑️'}
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
          </section>
        </>
      )}
    </div>
  );
}