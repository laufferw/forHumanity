export default function LoadingCard({ message }) {
  return (
    <section className="card">
      <p>{message || 'Loading...'}</p>
    </section>
  );
}
