import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useUser } from '../UserContextCore';
import './AuthModal.css';

export default function AuthModal({ open, onClose }) {
  const user = useUser();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setMode('login');
      setForm({ name: '', email: '', password: '' });
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const isSignup = mode === 'signup';

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = isSignup
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password };
      const session = await apiFetch(`/api/auth/${isSignup ? 'signup' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      user.login(session);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const logoutAndStay = () => {
    user.logout();
    setMode('login');
    setForm({ name: '', email: '', password: '' });
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="auth-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close login window">
          x
        </button>

        <div className="auth-copy">
          <p className="auth-eyebrow">VolleyOps Access</p>
          <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p>
            {isSignup
              ? 'New users start as athletes. Admins can update roles from the Users page.'
              : 'Sign in to switch accounts or continue with your current team workspace.'}
          </p>
        </div>

        {user.isAuthenticated && (
          <div className="auth-current-user">
            <span>{user.name}</span>
            <strong>{user.role}</strong>
            <button type="button" onClick={logoutAndStay}>Log out</button>
          </div>
        )}

        <div className="auth-tabs">
          <button type="button" className={!isSignup ? 'active' : ''} onClick={() => switchMode('login')}>
            Login
          </button>
          <button type="button" className={isSignup ? 'active' : ''} onClick={() => switchMode('signup')}>
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {isSignup && (
            <label>
              Full name
              <input
                type="text"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Tatiana Nohrat"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@volleyops.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="At least 6 characters"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Working...' : isSignup ? 'Create account' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
