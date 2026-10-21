import { useMemo, useState } from 'react';
import { distanceKm, requestCoords } from './geo';

/**
 * Optionally orders requests by distance from the viewer's current location.
 * Requests without coordinates keep their order at the end. Returns
 * `distances` keyed by request id for display.
 */
export default function useNearestFirst(requests) {
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const locate = () => {
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin([coords.longitude, coords.latitude]);
        setLocating(false);
      },
      () => {
        setLocateError('Could not get your location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const { sorted, distances } = useMemo(() => {
    if (!origin) return { sorted: requests, distances: {} };

    const distances = {};
    requests.forEach((r) => {
      const coords = requestCoords(r);
      if (coords) distances[r._id] = distanceKm(origin, coords);
    });

    const sorted = [...requests].sort((a, b) => {
      const da = distances[a._id] ?? Infinity;
      const db = distances[b._id] ?? Infinity;
      return da - db;
    });
    return { sorted, distances };
  }, [requests, origin]);

  return {
    sorted,
    distances,
    active: Boolean(origin),
    canLocate,
    locating,
    locateError,
    locate,
    clear: () => setOrigin(null),
  };
}
