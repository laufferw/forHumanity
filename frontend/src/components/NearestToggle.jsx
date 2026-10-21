/** Toolbar control for useNearestFirst. */
export default function NearestToggle({ nearest }) {
  if (!nearest.canLocate) return null;

  return (
    <>
      {nearest.active ? (
        <button type="button" className="secondary" onClick={nearest.clear}>
          Sort by newest
        </button>
      ) : (
        <button
          type="button"
          className="secondary"
          onClick={nearest.locate}
          disabled={nearest.locating}
        >
          {nearest.locating ? 'Locating...' : 'Sort by distance from me'}
        </button>
      )}
      {nearest.locateError && <span className="error">{nearest.locateError}</span>}
    </>
  );
}
