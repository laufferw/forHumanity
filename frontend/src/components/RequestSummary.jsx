import StatusBadge from './StatusBadge';
import { formatDistance } from '../lib/geo';
import { formatDate, mapsUrl } from '../lib/requests';

/**
 * Shared body for a request card. `showContact` reveals the requester's
 * name and phone, which only admins and the assigned volunteer should see.
 * `distance` (km) is shown when the list is sorted by distance.
 */
export default function RequestSummary({ request, showContact = false, distance }) {
  if (request.redactedAt) {
    return (
      <div className="request-summary">
        <div className="row between wrap">
          <strong className="muted">Details removed for privacy</strong>
          <StatusBadge status={request.status} />
        </div>
        <p className="muted">Submitted {formatDate(request.createdAt)}</p>
        {request.completedAt && (
          <p className="muted">Delivered {formatDate(request.completedAt)}</p>
        )}
      </div>
    );
  }

  const map = mapsUrl(request);

  return (
    <div className="request-summary">
      <div className="row between wrap">
        <strong>{request.location?.address || 'No address'}</strong>
        <StatusBadge status={request.status} />
      </div>
      {map && (
        <a href={map} target="_blank" rel="noreferrer" className="small-link">
          Open in maps
        </a>
      )}
      {distance !== undefined && <span className="muted"> · {formatDistance(distance)} away</span>}
      {showContact && (
        <p className="muted">
          {request.user?.name || 'Unknown'}
          {request.user?.phone && (
            <>
              {' · '}
              <a href={`tel:${request.user.phone}`}>{request.user.phone}</a>
            </>
          )}
          {request.user?.email && ` · ${request.user.email}`}
        </p>
      )}
      {request.notes && <p className="notes">{request.notes}</p>}
      <p className="muted">Submitted {formatDate(request.createdAt)}</p>
      {request.completedAt && <p className="muted">Delivered {formatDate(request.completedAt)}</p>}
    </div>
  );
}
