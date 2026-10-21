import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="card">
      <h2>Community blanket support</h2>
      <p>See someone who needs a blanket? Tell us where they are and a volunteer will bring one.</p>
      <ol className="steps">
        <li>Submit a request with a location and a way to reach you.</li>
        <li>A coordinator assigns it to a nearby volunteer.</li>
        <li>The volunteer delivers the blanket and marks the request done.</li>
      </ol>
      <div className="row gap wrap">
        <Link to="/request" className="button">
          Request a blanket
        </Link>
        {!isAuthenticated() && (
          <Link to="/login" className="button secondary">
            Volunteer or track requests
          </Link>
        )}
      </div>
    </section>
  );
}
