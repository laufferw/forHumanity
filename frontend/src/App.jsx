import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import './App.css';
import LoadingCard from './components/LoadingCard';
import { useAuth } from './context/AuthContext';
import AdminPage from './pages/AdminPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AuthPage from './pages/AuthPage';
import Home from './pages/Home';
import MyRequestsPage from './pages/MyRequestsPage';
import PrivacyPage from './pages/PrivacyPage';
import RequestPage from './pages/RequestPage';

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function Shell() {
  const { user, logout, isAuthenticated, getUserRole } = useAuth();
  const authed = isAuthenticated();
  const isAdmin = getUserRole() === 'admin';
  const isApproved = user?.status === 'active';

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          forHumanity
        </Link>
        <nav>
          <NavLink to="/request">Request Help</NavLink>
          {authed && <NavLink to="/my-requests">My Requests</NavLink>}
          {authed && isApproved && <NavLink to="/assignments">Assignments</NavLink>}
          {authed && isAdmin && <NavLink to="/admin">Admin</NavLink>}
          {!authed && <NavLink to="/login">Login</NavLink>}
        </nav>
        {authed && (
          <button className="secondary" onClick={logout}>
            Log out {user?.name ? `(${user.name})` : ''}
          </button>
        )}
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/request" element={<RequestPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/my-requests"
            element={
              <RequireAuth>
                <MyRequestsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/assignments"
            element={
              <RequireAuth>
                <AssignmentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth role="admin">
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="footer">
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}

function RequireAuth({ role, children }) {
  const { initializing, isAuthenticated, getUserRole } = useAuth();

  if (initializing) return <LoadingCard message="Checking your session..." />;
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (role && getUserRole() !== role) return <Navigate to="/" replace />;
  return children;
}

function NotFound() {
  return (
    <section className="card">
      <h2>Page not found</h2>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </section>
  );
}

export default App;
