import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './context/AuthContext';
import App from './App';

const mockApi = {
  refreshSession: jest.fn(),
  login: jest.fn(),
  createRequest: jest.fn(),
  getUserRequests: jest.fn(),
  getAssignedRequests: jest.fn(),
  getAllRequests: jest.fn(),
  updateRequestStatus: jest.fn(),
  assignRequest: jest.fn(),
  getAllUsers: jest.fn(),
  getDashboardStats: jest.fn(),
};

jest.mock('./services/api', () => ({
  AUTH_EXPIRED_EVENT: 'test:auth-expired',
  authService: {
    getCurrentUser: () => {
      const raw = global.localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    },
    isAuthenticated: () => !!global.localStorage.getItem('token'),
    refreshSession: (...args) => mockApi.refreshSession(...args),
    login: async (...args) => {
      const response = await mockApi.login(...args);
      global.localStorage.setItem('token', 't');
      global.localStorage.setItem('user', JSON.stringify(response.user));
      return response;
    },
    register: jest.fn(),
    logout: () => global.localStorage.clear(),
    updateProfile: jest.fn(),
  },
  requestService: {
    createRequest: (...args) => mockApi.createRequest(...args),
    getUserRequests: (...args) => mockApi.getUserRequests(...args),
    getAssignedRequests: (...args) => mockApi.getAssignedRequests(...args),
    getAllRequests: (...args) => mockApi.getAllRequests(...args),
    updateRequestStatus: (...args) => mockApi.updateRequestStatus(...args),
    assignRequest: (...args) => mockApi.assignRequest(...args),
  },
  adminService: {
    getAllUsers: (...args) => mockApi.getAllUsers(...args),
    getDashboardStats: (...args) => mockApi.getDashboardStats(...args),
  },
}));

const signIn = (user) => {
  localStorage.setItem('token', 't');
  localStorage.setItem('user', JSON.stringify(user));
  mockApi.refreshSession.mockResolvedValue({ token: 't', user });
};

const renderAt = (path) => {
  window.history.pushState({}, '', path);
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

beforeEach(() => {
  localStorage.clear();
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  mockApi.createRequest.mockResolvedValue({ _id: 'r1' });
  mockApi.getUserRequests.mockResolvedValue([]);
  mockApi.getAssignedRequests.mockResolvedValue([]);
  mockApi.getAllRequests.mockResolvedValue([]);
  mockApi.getAllUsers.mockResolvedValue([]);
  mockApi.getDashboardStats.mockResolvedValue({
    users: 0,
    requests: { total: 0, pending: 0, inProgress: 0, completed: 0 },
  });
});

test('submits a request only after consent is given', async () => {
  renderAt('/request');

  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'William' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '555-1212' } });
  fireEvent.change(screen.getByPlaceholderText('Address or nearby landmark'), {
    target: { value: '123 Main St' },
  });

  const submit = screen.getByRole('button', { name: /submit request/i });
  expect(submit).toBeDisabled();

  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(submit);

  await waitFor(() => expect(mockApi.createRequest).toHaveBeenCalledTimes(1));
  expect(mockApi.createRequest).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'William', phone: '555-1212', address: '123 Main St' })
  );
  expect(await screen.findByText(/sent to volunteers/i)).toBeInTheDocument();
});

test('redirects anonymous users from protected pages to login', async () => {
  renderAt('/assignments');
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
});

test('logs out when the stored session is no longer valid', async () => {
  localStorage.setItem('token', 'stale');
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Old', role: 'volunteer' }));
  mockApi.refreshSession.mockImplementation(async () => {
    localStorage.clear();
    throw new Error('Token is not valid');
  });

  renderAt('/my-requests');

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  expect(mockApi.getUserRequests).not.toHaveBeenCalled();
});

test('logging in takes a volunteer to their assignments', async () => {
  mockApi.login.mockResolvedValue({ user: { id: 'u1', name: 'Val', role: 'volunteer' } });
  renderAt('/login');

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'v@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secret123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(await screen.findByRole('heading', { name: 'My assignments' })).toBeInTheDocument();
});

test('volunteer can mark an assigned request delivered', async () => {
  signIn({ id: 'v1', name: 'Val', role: 'volunteer' });
  const assigned = {
    _id: 'r1',
    status: 'in-progress',
    user: { name: 'Sam', phone: '555-0000' },
    location: { address: 'Main & 3rd' },
    createdAt: '2026-10-01T10:00:00Z',
  };
  mockApi.getAssignedRequests.mockResolvedValue([assigned]);
  mockApi.updateRequestStatus.mockResolvedValue({ ...assigned, status: 'completed' });

  renderAt('/assignments');

  expect(await screen.findByText('Main & 3rd')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '555-0000' })).toHaveAttribute('href', 'tel:555-0000');

  fireEvent.click(screen.getByRole('button', { name: 'Mark delivered' }));

  await waitFor(() => expect(mockApi.updateRequestStatus).toHaveBeenCalledWith('r1', 'completed'));
  expect(await screen.findByText(/All your assignments are done/i)).toBeInTheDocument();
});

test('admin sees stats and can assign a request to a volunteer', async () => {
  signIn({ id: 'a1', name: 'Admin', role: 'admin' });
  mockApi.getDashboardStats.mockResolvedValue({
    users: 2,
    requests: { total: 1, pending: 1, inProgress: 0, completed: 0 },
  });
  mockApi.getAllUsers.mockResolvedValue([
    { id: 'a1', name: 'Admin', role: 'admin', status: 'active' },
    { id: 'v1', name: 'Val', role: 'volunteer', status: 'active' },
  ]);
  const pending = {
    _id: 'r1',
    status: 'pending',
    user: { name: 'Sam' },
    location: { address: 'A' },
  };
  mockApi.getAllRequests.mockResolvedValue([pending]);
  mockApi.assignRequest.mockResolvedValue({ ...pending, assignedTo: 'v1' });

  renderAt('/admin');

  expect(await screen.findByText('Pending requests')).toBeInTheDocument();
  const volunteerSelect = await screen.findByLabelText('Volunteer');
  await screen.findByRole('option', { name: 'Val' });
  fireEvent.change(volunteerSelect, { target: { value: 'v1' } });

  await waitFor(() => expect(mockApi.assignRequest).toHaveBeenCalledWith('r1', 'v1'));
  expect(await screen.findByText('Assigned to Val')).toBeInTheDocument();
});
