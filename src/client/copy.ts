// Every customer- and vendor-facing string lives here so the owner can review the wording in
// one place (Batch 1 §10.4). Brand name is spelled as on the logo: "Centre".

export const copy = {
  brand: 'Bunty Biryani Centre',

  customer: {
    homeTitle: "Today's menu",
    homeComingSoon: "Today's menu is on its way. Please check back soon.",
  },

  common: {
    tryAgain: 'Try again',
    loading: 'Loading…',
    notFoundTitle: 'Page not found',
    notFoundMessage: "We couldn't find that page.",
    backToMenu: 'Back to the menu',
    genericError: 'Something went wrong. Please try again.',
    networkError: "Couldn't reach the server. Check your connection.",
  },

  admin: {
    shellTitle: 'BBC ADMIN',
    logout: 'Log out',
    loggingOut: 'Logging out…',
    todayPlaceholder: 'Dashboard arrives in Batch 6.',
    sessionLoadError: "Couldn't check your login.",
    tabs: { today: 'Today', stock: 'Stock', menu: 'Menu', settings: 'Settings' },
    login: {
      title: 'VENDOR LOGIN',
      username: 'Username',
      password: 'Password',
      showPassword: 'Show password',
      submit: 'Log in',
      submitting: 'Logging in…',
      usernameRequired: 'Enter your username',
      passwordRequired: 'Enter your password',
      invalidCredentials: 'Wrong username or password.',
      rateLimited: 'Too many attempts. Try again in a few minutes.',
      network: "Couldn't reach the server. Check your connection.",
    },
  },
} as const;
