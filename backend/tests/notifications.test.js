const mockSendMail = jest.fn().mockResolvedValue(true);
jest.mock('../services/mailer', () => ({ sendMail: (...args) => mockSendMail(...args) }));

const mockFind = jest.fn();
jest.mock('../models/User', () => ({ find: (...args) => mockFind(...args) }));

const notifications = require('../services/notifications');

const request = {
  user: { name: 'Sam', email: 'sam@example.org', phone: '555-0100' },
  location: { address: 'Civic Center Park' },
  notes: 'Green jacket',
};

beforeEach(() => mockSendMail.mockClear());

test('assignment email has the address and a link, but not the phone number', async () => {
  process.env.APP_URL = 'https://help.example.org/';
  await notifications.volunteerAssigned(request, { name: 'Val', email: 'val@example.org' });

  const mail = mockSendMail.mock.calls[0][0];
  expect(mail.to).toBe('val@example.org');
  expect(mail.text).toContain('Civic Center Park');
  expect(mail.text).toContain('Green jacket');
  expect(mail.text).toContain('https://help.example.org/assignments');
  expect(mail.text).not.toContain('555-0100');
});

test('delivery email goes to the requester', async () => {
  await notifications.requestDelivered(request);
  expect(mockSendMail.mock.calls[0][0].to).toBe('sam@example.org');
});

test('new-volunteer email goes to every active admin', async () => {
  mockFind.mockReturnValue({
    select: jest.fn().mockResolvedValue([{ email: 'a1@x.org' }, { email: 'a2@x.org' }]),
  });
  await notifications.volunteerAwaitingApproval({ name: 'Val', email: 'val@example.org' });

  expect(mockFind).toHaveBeenCalledWith({ role: 'admin', status: 'active' });
  expect(mockSendMail.mock.calls[0][0].to).toEqual(['a1@x.org', 'a2@x.org']);
});

test('notify never rejects', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => notifications.notify(Promise.reject(new Error('boom')))).not.toThrow();
  await new Promise((r) => setImmediate(r));
  expect(console.error).toHaveBeenCalled();
});
