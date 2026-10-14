// Runs before first paint so the window opens in the right theme and accent.
(function () {
  var a = {};
  try { a = JSON.parse(localStorage.getItem('fieldlogger:appearance')) || {}; } catch (e) {}
  var dark = a.theme === 'dark' || (a.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-aurora', a.aurora === false ? 'off' : 'on');
  if (a.accent) root.style.setProperty('--accent', a.accent);
})();
