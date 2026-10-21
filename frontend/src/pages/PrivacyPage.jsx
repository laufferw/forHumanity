import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <section className="card prose">
      <h2>Privacy</h2>
      <p>
        forHumanity exists to get blankets to people who need them. We collect only what that takes,
        show it only to the people doing the delivery, and delete it when the job is done.
      </p>

      <h3>What we collect</h3>
      <ul>
        <li>
          <strong>Requests:</strong> your name and phone number, an optional email, the address or
          landmark, optional notes, and (only if you choose) your device&apos;s location.
        </li>
        <li>
          <strong>Volunteer accounts:</strong> name, email, optional phone, and a hashed password.
        </li>
      </ul>

      <h3>Who can see it</h3>
      <ul>
        <li>Coordinators (admins) who triage and assign requests.</li>
        <li>
          The one approved volunteer assigned to a request, and only while their account is active.
          New volunteers are reviewed before they can be assigned anything.
        </li>
        <li>You, for requests you submit while logged in.</li>
      </ul>
      <p>
        We don&apos;t sell or share this information, and we don&apos;t use it for anything except
        coordinating deliveries. Emails we send never include requesters&apos; phone numbers.
      </p>

      <h3>How long we keep it</h3>
      <p>
        Once a request has been delivered or cancelled for 90 days, we remove the name, phone,
        email, notes, address, and location from it. We keep only its status and dates, so we can
        count how many blankets were delivered.
      </p>

      <h3>Your choices</h3>
      <p>
        You can cancel an open request from <Link to="/my-requests">My requests</Link>. To have a
        request or your account deleted sooner, contact the coordinators who run this service and
        they will remove it.
      </p>
    </section>
  );
}
