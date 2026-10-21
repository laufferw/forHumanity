import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestService } from '../services/api';

const emptyForm = (user) => ({
  name: user?.name || '',
  email: user?.email || '',
  phone: user?.phone || '',
  address: '',
  notes: '',
  website: '',
});

export default function RequestPage() {
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState(() => emptyForm(user));
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const useMyLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: { longitude, latitude } }) => {
        setCoords([longitude, latitude]);
        setLocating(false);
      },
      () => {
        setStatus({
          type: 'error',
          text: 'Could not get your location. Enter an address instead.',
        });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', text: '' });
    setSubmitting(true);

    const { address, ...rest } = form;
    const payload = coords ? { ...rest, location: { address, coordinates: coords } } : form;

    try {
      await requestService.createRequest(payload);
      setStatus({ type: 'success', text: 'Thank you. Your request has been sent to volunteers.' });
      setForm(emptyForm(user));
      setCoords(null);
      setConsent(false);
    } catch (err) {
      setStatus({ type: 'error', text: err?.message || 'Failed to submit request.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2>Request a blanket delivery</h2>
      <form onSubmit={submit} className="stack">
        <label>
          Your name
          <input value={form.name} onChange={set('name')} required maxLength={100} />
        </label>
        <label>
          Phone
          <input type="tel" value={form.phone} onChange={set('phone')} required maxLength={40} />
        </label>
        <label>
          Email (optional)
          <input type="email" value={form.email} onChange={set('email')} />
        </label>
        <label>
          Where is the blanket needed?
          <input
            placeholder="Address or nearby landmark"
            value={form.address}
            onChange={set('address')}
            required
            maxLength={300}
          />
        </label>
        {canLocate && (
          <div className="row gap wrap">
            <button type="button" className="secondary" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Locating...' : coords ? 'Update my location' : 'Use my current location'}
            </button>
            {coords && (
              <span className="muted">
                Location attached ({coords[1].toFixed(4)}, {coords[0].toFixed(4)}){' '}
                <button type="button" className="link" onClick={() => setCoords(null)}>
                  remove
                </button>
              </span>
            )}
          </div>
        )}
        <label>
          Notes (optional)
          <textarea
            placeholder="How many people, what to look for, best time to come"
            rows={4}
            value={form.notes}
            onChange={set('notes')}
            maxLength={1000}
          />
        </label>
        {/* Honeypot for bots: hidden from people and assistive tech. */}
        <div className="honeypot" aria-hidden="true">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={set('website')}
            />
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I understand these details will be shared with forHumanity coordinators and the
            volunteer assigned to this delivery, and used only to deliver this request (
            <Link to="/privacy">privacy</Link>).
          </span>
        </label>
        <button type="submit" disabled={!consent || submitting}>
          {submitting ? 'Submitting...' : 'Submit request'}
        </button>
      </form>

      {status.text && (
        <p className={status.type === 'error' ? 'error' : 'success'} role="status">
          {status.text}{' '}
          {status.type === 'success' &&
            (isAuthenticated() ? (
              <Link to="/my-requests">Track it in My requests.</Link>
            ) : (
              <Link to="/login">Create an account to track future requests.</Link>
            ))}
        </p>
      )}
    </section>
  );
}
