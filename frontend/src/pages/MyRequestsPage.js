import { useState } from 'react';
import { Link } from 'react-router-dom';
import PendingNotice from '../components/PendingNotice';
import RequestSummary from '../components/RequestSummary';
import { useAuth } from '../context/AuthContext';
import { isOpen } from '../lib/requests';
import useLoader from '../lib/useLoader';
import { requestService } from '../services/api';

export default function MyRequestsPage() {
  const {
    data: requests,
    setData: setRequests,
    loading,
    error,
    setError,
  } = useLoader(() => requestService.getUserRequests(), []);
  const [savingId, setSavingId] = useState('');
  const { user } = useAuth();

  const cancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    setSavingId(id);
    setError('');
    try {
      const updated = await requestService.updateRequestStatus(id, 'cancelled');
      setRequests((prev) => prev.map((r) => (r._id === id ? updated : r)));
    } catch (err) {
      setError(err?.message || 'Could not cancel the request.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="card">
      <h2>My requests</h2>
      {user?.status === 'pending' && <PendingNotice />}
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && requests.length === 0 && (
        <p>
          You haven&apos;t submitted any requests while logged in.{' '}
          <Link to="/request">Request a blanket.</Link>
        </p>
      )}
      <ul className="cards">
        {requests.map((r) => (
          <li key={r._id} className="request-card">
            <RequestSummary request={r} />
            {isOpen(r) && (
              <button
                type="button"
                className="secondary"
                disabled={savingId === r._id}
                onClick={() => cancel(r._id)}
              >
                Cancel request
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
