import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Require email verification
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
  accountRecovery: 'EMAIL_ONLY',
});
