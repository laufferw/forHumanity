export const STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];

export const STATUS_LABELS = {
  pending: 'Pending',
  'in-progress': 'In progress',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};

export const isOpen = (request) => request.status === 'pending' || request.status === 'in-progress';

export const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// Links to Google Maps, preferring exact coordinates over the free-text address.
export const mapsUrl = (request) => {
  const coords = request.location?.coordinates?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const address = request.location?.address;
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
};
