import { useState } from 'react';
import NearestToggle from '../components/NearestToggle';
import RequestSummary from '../components/RequestSummary';
import { useAuth } from '../context/AuthContext';
import { STATUSES, STATUS_LABELS } from '../lib/requests';
import useLoader from '../lib/useLoader';
import useNearestFirst from '../lib/useNearestFirst';
import { adminService, requestService } from '../services/api';

const EMPTY_STATS = {
  users: 0,
  pendingUsers: 0,
  requests: { total: 0, pending: 0, inProgress: 0, completed: 0 },
};

export default function AdminPage() {
  const [tab, setTab] = useState('requests');
  const stats = useLoader(() => adminService.getDashboardStats(), EMPTY_STATS);
  const users = useLoader(() => adminService.getAllUsers(), []);

  const s = stats.data || EMPTY_STATS;

  return (
    <section className="card">
      <h2>Admin dashboard</h2>
      <div className="stats-grid">
        <Stat value={s.requests.pending} label="Pending requests" />
        <Stat value={s.requests.inProgress} label="In progress" />
        <Stat value={s.requests.completed} label="Delivered" />
        <Stat value={s.requests.total} label="Total requests" />
        <Stat value={s.users} label="Users" />
        <Stat value={s.pendingUsers} label="Awaiting approval" />
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'requests'}
          className={tab === 'requests' ? 'tab active' : 'tab'}
          onClick={() => setTab('requests')}
        >
          Requests
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={tab === 'users' ? 'tab active' : 'tab'}
          onClick={() => setTab('users')}
        >
          Users{s.pendingUsers > 0 && ` (${s.pendingUsers} to approve)`}
        </button>
      </div>

      {tab === 'requests' ? (
        <RequestsPanel users={users.data} onChange={stats.reload} />
      ) : (
        <UsersPanel users={users} onChange={stats.reload} />
      )}
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat-card">
      <h3>{value ?? 0}</h3>
      <p>{label}</p>
    </div>
  );
}

function RequestsPanel({ users, onChange }) {
  const [filter, setFilter] = useState('');
  const {
    data: requests,
    setData: setRequests,
    loading,
    error,
    setError,
    reload,
  } = useLoader(
    () => requestService.getAllRequests(filter ? { status: filter } : {}),
    [],
    [filter]
  );
  const [savingId, setSavingId] = useState('');
  const nearest = useNearestFirst(requests);

  const assignable = users.filter(
    (u) => u.status === 'active' && (u.role === 'volunteer' || u.role === 'admin')
  );
  const nameFor = (id) => users.find((u) => u.id === id)?.name;

  const run = async (id, action, fallbackMessage) => {
    setSavingId(id);
    setError('');
    try {
      await action();
      onChange();
    } catch (err) {
      setError(err?.message || fallbackMessage);
    } finally {
      setSavingId('');
    }
  };

  const replace = (updated) =>
    setRequests((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const changeStatus = (id, status) =>
    run(
      id,
      async () => replace(await requestService.updateRequestStatus(id, status)),
      'Failed to update request status.'
    );

  const assign = (id, userId) =>
    run(
      id,
      async () => replace(await requestService.assignRequest(id, userId || null)),
      'Failed to assign request.'
    );

  const remove = (id) => {
    if (!window.confirm('Delete this request permanently?')) return;
    run(
      id,
      async () => {
        await requestService.deleteRequest(id);
        setRequests((prev) => prev.filter((r) => r._id !== id));
      },
      'Failed to delete request.'
    );
  };

  return (
    <>
      <div className="row gap wrap toolbar">
        <label className="inline">
          Status{' '}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={reload}>
          Refresh
        </button>
        <NearestToggle nearest={nearest} />
      </div>

      {loading && <p>Loading requests...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && requests.length === 0 && <p>No requests.</p>}

      <ul className="cards">
        {nearest.sorted.map((r) => (
          <li key={r._id} className="request-card">
            <RequestSummary request={r} showContact distance={nearest.distances[r._id]} />
            {r.assignedTo && (
              <p className="muted">Assigned to {nameFor(r.assignedTo) || 'a former user'}</p>
            )}
            <div className="row gap wrap">
              <label className="inline">
                Status{' '}
                <select
                  value={r.status}
                  disabled={savingId === r._id}
                  onChange={(e) => changeStatus(r._id, e.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline">
                Volunteer{' '}
                <select
                  value={r.assignedTo || ''}
                  disabled={savingId === r._id}
                  onChange={(e) => assign(r._id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assignable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="danger"
                disabled={savingId === r._id}
                onClick={() => remove(r._id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// Volunteers awaiting approval first; otherwise keep the server's order.
const pendingFirst = (users) =>
  [...users].sort((a, b) => (b.status === 'pending') - (a.status === 'pending'));

function UsersPanel({ users, onChange }) {
  const { user: me } = useAuth();
  const { data, setData, loading, error, setError } = users;
  const [savingId, setSavingId] = useState('');

  const update = async (id, updates) => {
    setSavingId(id);
    setError('');
    try {
      const updated = await adminService.updateUser(id, updates);
      setData((prev) => prev.map((u) => (u.id === id ? updated : u)));
      onChange();
    } catch (err) {
      setError(err?.message || 'Failed to update user.');
    } finally {
      setSavingId('');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    setSavingId(id);
    setError('');
    try {
      await adminService.deleteUser(id);
      setData((prev) => prev.filter((u) => u.id !== id));
      onChange();
    } catch (err) {
      setError(err?.message || 'Failed to delete user.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <>
      {loading && <p>Loading users...</p>}
      {error && <p className="error">{error}</p>}
      <ul className="cards">
        {pendingFirst(data).map((u) => {
          const isMe = u.id === me?.id;
          return (
            <li key={u.id} className="request-card">
              <div className="row between wrap">
                <strong>
                  {u.name} {isMe && <span className="muted">(you)</span>}
                </strong>
                <span className={`badge badge-user-${u.status}`}>{u.status}</span>
              </div>
              <p className="muted">
                {u.email}
                {u.phone && ` · ${u.phone}`}
              </p>
              <div className="row gap wrap">
                {u.status === 'pending' && (
                  <button
                    type="button"
                    disabled={savingId === u.id}
                    onClick={() => update(u.id, { status: 'active' })}
                  >
                    Approve
                  </button>
                )}
                <label className="inline">
                  Role{' '}
                  <select
                    value={u.role}
                    disabled={isMe || savingId === u.id}
                    onChange={(e) => update(u.id, { role: e.target.value })}
                  >
                    <option value="volunteer">Volunteer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="inline">
                  Status{' '}
                  <select
                    value={u.status}
                    disabled={isMe || savingId === u.id}
                    onChange={(e) => update(u.id, { status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
                {!isMe && (
                  <button
                    type="button"
                    className="danger"
                    disabled={savingId === u.id}
                    onClick={() => remove(u.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
