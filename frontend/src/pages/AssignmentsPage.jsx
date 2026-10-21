import { useState } from 'react';
import NearestToggle from '../components/NearestToggle';
import PendingNotice from '../components/PendingNotice';
import RequestSummary from '../components/RequestSummary';
import { useAuth } from '../context/AuthContext';
import { isOpen } from '../lib/requests';
import useLoader from '../lib/useLoader';
import useNearestFirst from '../lib/useNearestFirst';
import { requestService } from '../services/api';

export default function AssignmentsPage() {
  const {
    data: requests,
    setData: setRequests,
    loading,
    error,
    setError,
  } = useLoader(() => requestService.getAssignedRequests(), []);
  const [savingId, setSavingId] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const { user } = useAuth();

  const setStatus = async (id, status) => {
    setSavingId(id);
    setError('');
    try {
      const updated = await requestService.updateRequestStatus(id, status);
      setRequests((prev) => prev.map((r) => (r._id === id ? updated : r)));
    } catch (err) {
      setError(err?.message || 'Could not update the request.');
    } finally {
      setSavingId('');
    }
  };

  const open = requests.filter(isOpen);
  const nearest = useNearestFirst(showClosed ? requests : open);
  const visible = nearest.sorted;

  if (user?.status === 'pending') {
    return (
      <section className="card">
        <h2>My assignments</h2>
        <PendingNotice />
      </section>
    );
  }

  return (
    <section className="card">
      <div className="row between wrap">
        <h2>My assignments</h2>
        <div className="row gap wrap">
          <NearestToggle nearest={nearest} />
          <label className="checkbox inline">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            <span>Show delivered and cancelled</span>
          </label>
        </div>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p>
          {open.length === 0 && requests.length > 0
            ? 'All your assignments are done. Thank you!'
            : 'Nothing assigned to you yet. A coordinator will assign deliveries to you.'}
        </p>
      )}
      <ul className="cards">
        {visible.map((r) => (
          <li key={r._id} className="request-card">
            <RequestSummary request={r} showContact distance={nearest.distances[r._id]} />
            <div className="row gap wrap">
              {r.status === 'pending' && (
                <button
                  type="button"
                  disabled={savingId === r._id}
                  onClick={() => setStatus(r._id, 'in-progress')}
                >
                  Start delivery
                </button>
              )}
              {isOpen(r) && (
                <button
                  type="button"
                  disabled={savingId === r._id}
                  onClick={() => setStatus(r._id, 'completed')}
                >
                  Mark delivered
                </button>
              )}
              {r.status === 'in-progress' && (
                <button
                  type="button"
                  className="secondary"
                  disabled={savingId === r._id}
                  onClick={() => setStatus(r._id, 'pending')}
                >
                  Not started
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
