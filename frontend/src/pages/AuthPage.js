import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PASSWORD_HINT =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.';

// Where to land after signing in: pending volunteers can't take deliveries
// yet, so they go to their own requests.
const homeFor = (user, role) => {
  if (role === 'admin') return '/admin';
  if (user?.status === 'pending') return '/my-requests';
  return '/assignments';
};

export default function AuthPage() {
  const { user, login, register, loading, error, clearError, isAuthenticated, getUserRole } =
    useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (isAuthenticated()) {
    return <Navigate to={homeFor(user, getUserRole())} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
    } catch {
      // surfaced by context
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <section className="card narrow">
      <div className="row between">
        <h2>{mode === 'login' ? 'Log in' : 'Create a volunteer account'}</h2>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Create account' : 'I have an account'}
        </button>
      </div>

      <form onSubmit={onSubmit} className="stack">
        {mode === 'register' && (
          <label>
            Name
            <input value={form.name} onChange={set('name')} required autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            required
            autoComplete="email"
          />
        </label>
        {mode === 'register' && (
          <label>
            Phone (optional)
            <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </label>
        )}
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {mode === 'register' && (
          <p className="muted">
            {PASSWORD_HINT} New volunteer accounts are reviewed by an admin before you can take
            deliveries.
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
