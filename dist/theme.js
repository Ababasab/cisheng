// Apply before styles load so a saved light theme never flashes dark on refresh.
(() => {
  const key = 'word-notes-theme';
  const colors = { codex: '#181818', green: '#244f42', blue: '#f5f8ff' };
  const valid = value => Object.hasOwn(colors, value) ? value : 'codex';
  const apply = value => {
    const theme = valid(value);
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[theme]);
    const select = document.getElementById('theme-choice');
    if (select) select.value = theme;
  };
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
  apply(saved);
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('theme-choice');
    if (!select) return;
    select.value = document.documentElement.dataset.theme;
    select.addEventListener('change', () => {
      apply(select.value);
      try { localStorage.setItem(key, select.value); } catch { /* Switching still works. */ }
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();
