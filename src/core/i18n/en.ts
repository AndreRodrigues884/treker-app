// Source dictionary: its shape defines the Messages type every other language must match.
export const en = {
  common: {
    loading: 'Loading',
  },
  home: {
    tagline: 'Gym and swim tracking for self-coached athletes.',
    greeting: 'Hi, {name}',
    signOut: 'Sign out',
  },
  records: {
    prShort: 'PR',
    prLabel: 'Personal record',
  },
  auth: {
    emailTitle: 'Sign in',
    emailSubtitle: "We'll email you a 6-digit code. No password needed.",
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    sendCode: 'Send code',
    codeTitle: 'Enter the code',
    codeSubtitle: 'We sent a 6-digit code to {email}.',
    codeLabel: '6-digit code',
    verify: 'Continue',
    resend: 'Send a new code',
    resendIn: 'Send a new code in {seconds} s',
    codeResent: 'We sent you a new code.',
    changeEmail: 'Use another email',
    errors: {
      invalidEmail: 'Enter a valid email address.',
      invalidCodeFormat: 'The code has 6 digits.',
      wrongCode: "That code isn't right. Check the latest email and try again.",
      expiredCode: 'This code has expired. Ask for a new one.',
      tooManyAttempts: 'Too many attempts. Wait a few minutes and try again.',
      network: 'No connection. Check your internet and try again.',
      generic: 'Something went wrong. Try again.',
    },
  },
  onboarding: {
    title: 'Welcome to Treker',
    subtitle: 'A few details to set up your training log.',
    nameLabel: 'Name',
    weightUnitLabel: 'Weight unit',
    poolUnitLabel: 'Pool unit',
    metres: 'Metres',
    yards: 'Yards',
    bodyweightLabel: 'Bodyweight in {unit} (optional)',
    bodyweightHint:
      'Used for the 1RM of pull-ups and dips, where your bodyweight is part of the load.',
    continue: 'Continue',
    errors: {
      nameRequired: 'Enter your name.',
      bodyweightInvalid: 'Enter a realistic bodyweight, or leave it empty.',
    },
  },
};

export type Messages = typeof en;
