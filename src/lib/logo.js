// The horizontal logo for pages that show it on the page background (not in a green bar):
// green on the cream page in light mode, gold on the forest page in dark mode.
export const brandLogo = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? '/Gold Horizontal Logo.png'
    : '/Green Horizontal Logo.png'
