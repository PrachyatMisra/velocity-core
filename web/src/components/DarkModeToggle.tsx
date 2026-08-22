import { useEffect } from 'react';

const DarkModeToggle = () => {
  // Initialize theme based on system preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn-secondary"
      aria-label="Toggle dark mode"
      style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 200 }}
    >
      {document.documentElement.getAttribute('data-theme') === 'dark' ? '🌞 Light' : '🌙 Dark'}
    </button>
  );
};

export default DarkModeToggle;
