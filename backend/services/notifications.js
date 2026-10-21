const User = require('../models/User');
const { sendMail } = require('./mailer');

// Links in emails point at the frontend.
const appUrl = (path) =>
  `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}${path}`;

// Emails deliberately leave out the requester's phone number: volunteers see
// contact details in the app, behind sign-in, not in their inbox.

const volunteerAssigned = async (request, volunteer) =>
  sendMail({
    to: volunteer.email,
    subject: 'New blanket delivery assigned to you',
    text: [
      `Hi ${volunteer.name},`,
      '',
      'A blanket delivery has been assigned to you:',
      `  Where: ${request.location?.address}`,
      ...(request.notes ? [`  Notes: ${request.notes}`] : []),
      '',
      `Contact details and directions are in your assignments: ${appUrl('/assignments')}`,
      '',
      'Thank you for volunteering.',
    ].join('\n'),
  });

const requestDelivered = async (request) =>
  sendMail({
    to: request.user?.email,
    subject: 'Your blanket request was delivered',
    text: [
      `Hi ${request.user?.name},`,
      '',
      `A volunteer has delivered the blanket you requested for ${request.location?.address}.`,
      '',
      'Thank you for looking out for someone.',
    ].join('\n'),
  });

const volunteerAwaitingApproval = async (volunteer) => {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('email');
  return sendMail({
    to: admins.map((a) => a.email),
    subject: 'New volunteer awaiting approval',
    text: [
      `${volunteer.name} (${volunteer.email}) signed up to volunteer.`,
      '',
      `Review and approve them on the Users tab: ${appUrl('/admin')}`,
    ].join('\n'),
  });
};

const volunteerApproved = async (volunteer) =>
  sendMail({
    to: volunteer.email,
    subject: 'Your forHumanity volunteer account is approved',
    text: [
      `Hi ${volunteer.name},`,
      '',
      "You're approved! Coordinators can now assign blanket deliveries to you.",
      `Your assignments will appear here: ${appUrl('/assignments')}`,
    ].join('\n'),
  });

// Runs a notification without delaying or failing the response.
const notify = (promise) => {
  Promise.resolve(promise).catch((err) =>
    console.error(JSON.stringify({ level: 'error', type: 'notify_failed', message: err.message }))
  );
};

module.exports = {
  notify,
  volunteerAssigned,
  requestDelivered,
  volunteerAwaitingApproval,
  volunteerApproved,
};
