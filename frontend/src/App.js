import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import { useAuth } from './context/AuthContext';
import { requestService } from './services/api';

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function Shell() {
  const { user, logout, isAuthenticated } = useAuth();
  const authed = isAuthenticated();

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>forHumanity</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/request">Request Help</Link>
          {authed ? <Link to="/my-requests">My Requests</Link> : <Link to="/login">Login</Link>}
        </nav>
        {authed && (
          <button className="secondary" onClick={logout}>
            Log out {user?.name ? `(${user.name})` : ''}
          </button>
        )}
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/request" element={<RequestPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route
            path="/my-requests"
            element={authed ? <MyRequestsPage /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

function Home() {
  return (
    <section className="card">
      <h2>Community blanket support</h2>
      <p>
        Submit a request when someone needs help, and volunteers can coordinate fulfillment quickly.
      </p>
      <p>
        Start by creating a request. If you register an account, you can also track your submitted requests.
      </p>
    </section>
  );
}

function AuthPage() {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [message, setMessage] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
        setMessage('Logged in successfully.');
      } else {
        await register(form);
        setMessage('Registered and logged in successfully.');
      }
    } catch (err) {
      // surfaced by context
    }
  };

  return (
    <section className="card">
      <div className="row between">
        <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
        <button className="secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          Switch to {mode === 'login' ? 'register' : 'login'}
        </button>
      </div>

      <form onSubmit={onSubmit} className="stack">
        {mode === 'register' && (
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        {mode === 'register' && (
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
    </section>
  );
}

function RequestPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [status, setStatus] = useState({ type: '', text: '' });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', text: '' });

    try {
      await requestService.createRequest(form);
      setStatus({ type: 'success', text: 'Request submitted successfully.' });
      setForm({ name: '', email: '', phone: '', address: '', notes: '' });
    } catch (err) {
      setStatus({ type: 'error', text: err?.message || 'Failed to submit request.' });
    }
  };

  return (
    <section className="card">
      <h2>Request a blanket delivery</h2>
      <form onSubmit={submit} className="stack">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <input
          placeholder="Address or nearby landmark"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          required
        />
        <textarea
          placeholder="Notes"
          rows={4}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit">Submit request</button>
      </form>

      {status.text && <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>}
    </section>
  );
}

function MyRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await requestService.getUserRequests();
        if (!cancelled) setRequests(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load requests.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card">
      <h2>My requests</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && requests.length === 0 && <p>No requests yet.</p>}
      <ul className="list">
        {requests.map((r) => (
          <li key={r._id || `${r.createdAt}-${r.user?.name}`}>
            <strong>{r.status}</strong> — {r.location?.address || 'No address'}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default App;
