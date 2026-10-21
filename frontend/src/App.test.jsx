import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from './context/AuthContext';
import App from './App';

// vi.mock is hoisted above imports, so the shared mocks must be too.
const mockApi = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  login: vi.fn(),
  createRequest: vi.fn(),
  getUserRequests: vi.fn(),
  getAssignedRequests: vi.fn(),
  getAllRequests: vi.fn(),
  updateRequestStatus: vi.fn(),
  assignRequest: vi.fn(),
  getAllUsers: vi.fn(),
  updateUser: vi.fn(),
  getDashboardStats: vi.fn(),
}));

vi.mock('./services/api', () => ({
  AUTH_EXPIRED_EVENT: 'test:auth-expired',
  authService: {
    getCurrentUser: () => {
      const raw = globalThis.localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    },
    isAuthenticated: () => !!globalThis.localStorage.getItem('token'),
    refreshSession: (...args) => mockApi.refreshSession(...args),
    login: async (...args) => {
      const response = await mockApi.login(...args);
      globalThis.localStorage.setItem('token', 't');
      globalThis.localStorage.setItem('user', JSON.stringify(response.user));
      return response;
    },
    register: vi.fn(),
    logout: () => globalThis.localStorage.clear(),
    updateProfile: vi.fn(),
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
    updateUser: (...args) => mockApi.updateUser(...args),
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
  mockApi.login.mockResolvedValue({
    user: { id: 'u1', name: 'Val', role: 'volunteer', status: 'active' },
  });
  renderAt('/login');

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'v@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secret123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(await screen.findByRole('heading', { name: 'My assignments' })).toBeInTheDocument();
});

test('volunteer can mark an assigned request delivered', async () => {
  signIn({ id: 'v1', name: 'Val', role: 'volunteer', status: 'active' });
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
  signIn({ id: 'a1', name: 'Admin', role: 'admin', status: 'active' });
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

test('pending volunteers see an approval notice instead of assignments', async () => {
  signIn({ id: 'p1', name: 'Pat', role: 'volunteer', status: 'pending' });
  renderAt('/assignments');

  expect(await screen.findByText(/admin will review your account/i)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Assignments' })).not.toBeInTheDocument();
});

test('admin can approve a pending volunteer', async () => {
  signIn({ id: 'a1', name: 'Admin', role: 'admin', status: 'active' });
  const pat = {
    id: 'p1',
    name: 'Pat',
    email: 'pat@example.com',
    role: 'volunteer',
    status: 'pending',
  };
  mockApi.getAllUsers.mockResolvedValue([
    { id: 'a1', name: 'Admin', email: 'a@example.com', role: 'admin', status: 'active' },
    pat,
  ]);
  mockApi.getDashboardStats.mockResolvedValue({
    users: 2,
    pendingUsers: 1,
    requests: { total: 0, pending: 0, inProgress: 0, completed: 0 },
  });
  mockApi.updateUser.mockResolvedValue({ ...pat, status: 'active' });

  renderAt('/admin');
  fireEvent.click(await screen.findByRole('tab', { name: /Users \(1 to approve\)/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

  await waitFor(() => expect(mockApi.updateUser).toHaveBeenCalledWith('p1', { status: 'active' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  );
});

test('volunteer can sort assignments by distance', async () => {
  signIn({ id: 'v1', name: 'Val', role: 'volunteer', status: 'active' });
  const at = (id, address, coordinates) => ({
    _id: id,
    status: 'pending',
    user: { name: 'S', phone: '1' },
    location: { address, ...(coordinates && { coordinates: { type: 'Point', coordinates } }) },
  });
  mockApi.getAssignedRequests.mockResolvedValue([
    at('far', 'Far away', [-104.0, 39.7]),
    at('none', 'No coordinates'),
    at('near', 'Nearby', [-104.99, 39.74]),
  ]);
  const geolocation = {
    getCurrentPosition: (success) =>
      success({ coords: { longitude: -104.9903, latitude: 39.7392 } }),
  };
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: geolocation,
    configurable: true,
  });

  try {
    renderAt('/assignments');
    await screen.findByText('Far away');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by distance from me' }));

    const addresses = await screen.findAllByText(/Far away|No coordinates|Nearby/);
    expect(addresses.map((el) => el.textContent)).toEqual(['Nearby', 'Far away', 'No coordinates']);
    expect(screen.getByText(/km away/)).toBeInTheDocument();
  } finally {
    delete globalThis.navigator.geolocation;
  }
});
