/* Shared theme cycle. FOUC sniffer stays inline in <head>; this wires the aleph mark. */
(function (global) {
  var THEMES = ['cyan-purple', 'yellow-brown', 'magenta-orange', 'yellow-green'];
  var THEME_LABELS = {
    'cyan-purple': 'Cyan → Purple',
    'yellow-brown': 'Yellow → Brown',
    'magenta-orange': 'Magenta → Orange',
    'yellow-green': 'Bright Yellow-Green'
  };

  function normalize(theme) {
    if (theme === 'orange-magenta') theme = 'magenta-orange';
    if (theme === 'leo' || theme === 'gemini' || theme === 'capricorn') theme = 'yellow-brown';
    if (theme === 'sagittarius' || theme === 'libra' || theme === 'scorpio' || theme === 'aries') theme = 'magenta-orange';
    return THEMES.indexOf(theme) !== -1 ? theme : 'cyan-purple';
  }

  function current() {
    return normalize(document.documentElement.getAttribute('data-theme'));
  }

  function apply(theme) {
    var next = normalize(theme);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('or_theme_v1', next); } catch (e) {}
    var mark = document.getElementById('themeToggle');
    if (mark) mark.title = 'Theme: ' + THEME_LABELS[next] + ' — click to change';
  }

  function cycle() {
    var i = THEMES.indexOf(current());
    apply(THEMES[(i + 1) % THEMES.length]);
  }

  function wireMark() {
    apply(current());
    var mark = document.getElementById('themeToggle');
    if (!mark || mark.getAttribute('data-or-theme-wired') === '1') return;
    mark.setAttribute('data-or-theme-wired', '1');
    mark.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      cycle();
    });
    mark.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        cycle();
      }
    });
  }

  global.OR_THEME = {
    THEMES: THEMES,
    THEME_LABELS: THEME_LABELS,
    normalize: normalize,
    current: current,
    apply: apply,
    cycle: cycle,
    wireMark: wireMark
  };
})(window);
