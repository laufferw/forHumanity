const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock('nodemailer', () => ({ createTransport: (...args) => mockCreateTransport(...args) }));

const loadMailer = () => {
  jest.resetModules();
  return require('../services/mailer');
};

describe('mailer', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.clearAllMocks();
  });

  test('does nothing when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const { sendMail } = loadMailer();

    expect(await sendMail({ to: 'a@b.org', subject: 's', text: 't' })).toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  test('sends through the configured SMTP server', async () => {
    Object.assign(process.env, {
      SMTP_HOST: 'smtp.example.org',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      MAIL_FROM: 'forHumanity <hi@example.org>',
    });
    mockSendMail.mockResolvedValue({});
    const { sendMail } = loadMailer();

    expect(await sendMail({ to: 'a@b.org', subject: 'Hello', text: 'Body' })).toBe(true);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.org',
      port: 465,
      secure: true,
      auth: { user: 'u', pass: 'p' },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'forHumanity <hi@example.org>',
      to: 'a@b.org',
      subject: 'Hello',
      text: 'Body',
    });
  });

  test('swallows SMTP failures', async () => {
    process.env.SMTP_HOST = 'smtp.example.org';
    mockSendMail.mockRejectedValue(new Error('connection refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMail } = loadMailer();

    await expect(sendMail({ to: 'a@b.org', subject: 's', text: 't' })).resolves.toBe(false);
  });

  test('skips sending when there is no recipient', async () => {
    process.env.SMTP_HOST = 'smtp.example.org';
    const { sendMail } = loadMailer();

    expect(await sendMail({ to: undefined, subject: 's', text: 't' })).toBe(false);
    expect(await sendMail({ to: [], subject: 's', text: 't' })).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
