import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import { useAuth } from './context/AuthContext';
import { adminService, requestService } from './services/api';

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function Shell() {
  const { user, logout, isAuthenticated, getUserRole, loading } = useAuth();
  const authed = isAuthenticated();
  const role = getUserRole();
  const isAdmin = role === 'admin';

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>forHumanity</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/request">Request Help</Link>
          {authed ? <Link to="/my-requests">My Requests</Link> : <Link to="/login">Login</Link>}
          {authed && isAdmin && <Link to="/admin">Admin</Link>}
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
            element={
              loading ? (
                <LoadingCard message="Checking your session..." />
              ) : authed ? (
                <MyRequestsPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              loading ? (
                <LoadingCard message="Checking your session..." />
              ) : authed && isAdmin ? (
                <AdminPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
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
        Start by creating a request. If you register an account, you can also track your submitted
        requests.
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
    } catch {
      // surfaced by context
    }
  };

  return (
    <section className="card">
      <div className="row between">
        <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
        <button
          className="secondary"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
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

      {status.text && (
        <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>
      )}
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

function LoadingCard({ message }) {
  return (
    <section className="card">
      <p>{message || 'Loading...'}</p>
    </section>
  );
}

function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    users: 0,
    requests: { total: 0, pending: 0, completed: 0 },
  });
  const [savingRequestId, setSavingRequestId] = useState('');

  const load = async (cancelledRef) => {
    setLoading(true);
    setError('');
    try {
      const [dashboardStats, allUsers, allRequests] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getAllUsers(),
        requestService.getAllRequests(),
      ]);

      if (!cancelledRef.current) {
        setStats(dashboardStats || { users: 0, requests: { total: 0, pending: 0, completed: 0 } });
        setUsers(Array.isArray(allUsers) ? allUsers : []);
        setRequests(Array.isArray(allRequests) ? allRequests : []);
      }
    } catch (err) {
      if (!cancelledRef.current) setError(err?.message || 'Failed to load admin data.');
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    load(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const refreshQuick = async () => {
    const cancelledRef = { current: false };
    await load(cancelledRef);
  };

  const updateRequestInState = (updated) => {
    setRequests((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
  };

  const handleStatusChange = async (requestId, status) => {
    setSavingRequestId(requestId);
    setError('');
    try {
      const updated = await requestService.updateRequestStatus(requestId, status);
      updateRequestInState(updated);
      await refreshQuick();
    } catch (err) {
      setError(err?.message || 'Failed to update request status.');
    } finally {
      setSavingRequestId('');
    }
  };

  const handleAssign = async (requestId, assignedTo) => {
    setSavingRequestId(requestId);
    setError('');
    try {
      const updated = await requestService.assignRequest(requestId, assignedTo || null);
      updateRequestInState(updated);
    } catch (err) {
      setError(err?.message || 'Failed to assign request.');
    } finally {
      setSavingRequestId('');
    }
  };

  const volunteers = users.filter((u) => u.role === 'volunteer' || u.role === 'admin');

  return (
    <section className="card">
      <h2>Admin dashboard</h2>
      {loading && <p>Loading dashboard...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{stats.users}</h3>
              <p>Users</p>
            </div>
            <div className="stat-card">
              <h3>{stats.requests.total}</h3>
              <p>Total requests</p>
            </div>
            <div className="stat-card">
              <h3>{stats.requests.pending}</h3>
              <p>Pending requests</p>
            </div>
            <div className="stat-card">
              <h3>{stats.requests.completed}</h3>
              <p>Completed requests</p>
            </div>
          </div>
          <h3>Recent requests</h3>
          <ul className="list">
            {requests.slice(0, 12).map((r) => (
              <li key={r._id || `${r.createdAt}-${r.user?.name}`} className="request-row">
                <div>
                  <strong>{r.user?.name || 'Unknown'}</strong> —{' '}
                  {r.location?.address || 'No address'}
                  <div className="muted">Current: {r.status}</div>
                </div>
                <div className="request-controls">
                  <select
                    value={r.status}
                    disabled={savingRequestId === r._id}
                    onChange={(e) => handleStatusChange(r._id, e.target.value)}
                  >
                    <option value="pending">pending</option>
                    <option value="in-progress">in-progress</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <select
                    value={r.assignedTo || ''}
                    disabled={savingRequestId === r._id}
                    onChange={(e) => handleAssign(r._id, e.target.value)}
                  >
                    <option value="">unassigned</option>
                    {volunteers.map((u) => (
                      <option key={u.id || u._id} value={u.id || u._id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default App;
