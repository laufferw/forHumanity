// Statuses that may sign in. Pending accounts (new volunteers awaiting
// approval) can sign in to track their own requests but can't be assigned
// deliveries or use admin features until an admin activates them.
const SIGN_IN_STATUSES = ['active', 'pending'];

const canSignIn = (status) => SIGN_IN_STATUSES.includes(status);

module.exports = { canSignIn };
