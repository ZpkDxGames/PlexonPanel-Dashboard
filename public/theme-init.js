/* CSP-compatible, synchronous theme selection before React and before first paint. */
try {
  const saved = JSON.parse(localStorage.getItem('plexon:preferences') || '{}');
  const requested = saved.theme || 'system';
  document.documentElement.dataset.theme = requested === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : requested === 'dark' ? 'dark' : 'light';
} catch { document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
