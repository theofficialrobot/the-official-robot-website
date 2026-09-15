/* Mobile hamburger: backdrop, Escape, link close, resize collapse. */
(function (global) {
  function wire() {
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    var backdrop = document.getElementById('navBackdrop');
    if (!toggle || !links) return;
    if (toggle.getAttribute('data-or-nav-wired') === '1') return;
    toggle.setAttribute('data-or-nav-wired', '1');

    function setOpen(open) {
      links.classList.toggle('open', open);
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('nav-open', open);
      if (backdrop) {
        backdrop.classList.toggle('open', open);
        backdrop.hidden = !open;
      }
    }
    function isOpen() { return links.classList.contains('open'); }

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!isOpen());
    });
    if (backdrop) backdrop.addEventListener('click', function () { setOpen(false); });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && isOpen()) setOpen(false);
    });
  }

  global.OR_NAV = { wire: wire };
})(window);
