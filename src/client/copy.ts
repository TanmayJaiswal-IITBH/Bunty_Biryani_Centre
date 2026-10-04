// Every customer- and vendor-facing string lives here so the owner can review the wording in
// one place (Batch 1 §10.4). Brand name is spelled as on the logo: "Centre".

export const copy = {
  brand: 'Bunty Biryani Centre',

  customer: {
    menu: {
      title: "Today's menu",
      subline: (date: string) => `Today's menu · ${date}`,
      loadErrorTitle: "Couldn't load today's menu.",
      loadErrorMessage: 'Check your connection and try again.',
      emptyTitle: "Today's menu isn't up yet.",
      emptyMessage: 'Please check back soon.',
      allSoldOut: "Everything's sold out for today. See you tomorrow!",
      paused: 'Orders are temporarily paused. Please check again shortly.',
      soldOutHeading: 'Sold out',
      soldOutChip: 'Sold out',
      add: 'Add',
      onlyLeft: (n: number) => `Only ${n} left`,
      maxPerOrder: (n: number) => `Max ${n} per order`,
      addLabel: (name: string) => `Add ${name}`,
      decrementLabel: (name: string) => `Remove one ${name}`,
      incrementLabel: (name: string) => `Add one more ${name}`,
    },

    cart: {
      itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
      checkout: 'Checkout',
      checkoutLabel: (items: string, total: string) => `Checkout, ${items}, ${total}`,
      paused: 'Orders are paused',
      dismiss: 'Dismiss',
      lineCap: (n: number) => `You can order up to ${n} different items at once.`,
      clearedOldDay: 'Your cart from yesterday was cleared.',
      removedUnavailable: (name: string) =>
        `${name} is no longer available and was removed from your cart.`,
      removedSoldOut: (name: string) => `${name} just sold out and was removed from your cart.`,
      capped: (n: number, name: string) => `Only ${n} ${name} left. We've updated your cart.`,
    },

    checkout: {
      comingSoon: 'Checkout is coming soon.',
    },
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
