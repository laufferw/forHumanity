import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './context/AuthContext';
import App from './App';

const mockCreateRequest = jest.fn();
const mockGetUserRequests = jest.fn();
const mockGetAllUsers = jest.fn();
const mockGetAllRequests = jest.fn();
const mockGetDashboardStats = jest.fn();

jest.mock('./services/api', () => ({
  authService: {
    getCurrentUser: () => {
      const raw = global.localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    },
    register: jest
      .fn()
      .mockResolvedValue({ user: { id: 'u2', name: 'New User', role: 'volunteer' } }),
    login: jest
      .fn()
      .mockResolvedValue({ user: { id: 'u1', name: 'Test User', role: 'volunteer' } }),
    logout: jest.fn(),
    updateProfile: jest.fn(),
    isAuthenticated: () => !!global.localStorage.getItem('token'),
  },
  requestService: {
    createRequest: (...args) => mockCreateRequest(...args),
    getUserRequests: (...args) => mockGetUserRequests(...args),
    getAllRequests: (...args) => mockGetAllRequests(...args),
  },
  adminService: {
    getAllUsers: (...args) => mockGetAllUsers(...args),
    getDashboardStats: (...args) => mockGetDashboardStats(...args),
  },
}));

beforeEach(() => {
  localStorage.clear();
  mockCreateRequest.mockReset();
  mockGetUserRequests.mockReset();
  mockGetAllUsers.mockReset();
  mockGetAllRequests.mockReset();
  mockGetDashboardStats.mockReset();

  mockCreateRequest.mockResolvedValue({ ok: true });
  mockGetUserRequests.mockResolvedValue([]);
  mockGetAllUsers.mockResolvedValue([]);
  mockGetAllRequests.mockResolvedValue([]);
  mockGetDashboardStats.mockResolvedValue({ users: 0, requests: { total: 0, pending: 0, completed: 0 } });
});

test('submits request form', async () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  fireEvent.click(screen.getByText(/Request Help/i));

  fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'William' } });
  fireEvent.change(screen.getByPlaceholderText('Phone'), { target: { value: '555-1212' } });
  fireEvent.change(screen.getByPlaceholderText('Address or nearby landmark'), {
    target: { value: '123 Main St' },
  });
  fireEvent.change(screen.getByPlaceholderText('Notes'), { target: { value: 'Urgent' } });

  fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

  await waitFor(() => expect(mockCreateRequest).toHaveBeenCalledTimes(1));
  expect(mockCreateRequest).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'William', phone: '555-1212', address: '123 Main St' })
  );
});

test('shows admin dashboard link and stats for admin user', async () => {
  localStorage.setItem('token', 't');
  localStorage.setItem('user', JSON.stringify({ id: 'a1', name: 'Admin', role: 'admin' }));
  mockGetAllUsers.mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }]);
  mockGetDashboardStats.mockResolvedValue({
    users: 2,
    requests: { total: 2, pending: 1, completed: 1 },
  });
  mockGetAllRequests.mockResolvedValue([
    { _id: 'r1', status: 'pending', user: { name: 'W' }, location: { address: 'A' } },
    { _id: 'r2', status: 'completed', user: { name: 'X' }, location: { address: 'B' } },
  ]);

  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  fireEvent.click(screen.getByRole('link', { name: 'Admin' }));

  await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGetAllUsers).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGetAllRequests).toHaveBeenCalledTimes(1));

  expect(screen.getByText(/Admin dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/Total requests/i)).toBeInTheDocument();
  expect(screen.getByText(/Pending requests/i)).toBeInTheDocument();
});
