/* Home waitlist + session splash. Theme/nav are wired by shell.js. */
(function () {
  function handleSubmit(e) {
    e.preventDefault();
    var emailEl = document.getElementById('email');
    var email = emailEl ? emailEl.value.trim() : '';
    if (!email) return false;

    var btn = document.getElementById('submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    }

    setTimeout(function () {
      try {
        var list = JSON.parse(localStorage.getItem('or_waitlist') || '[]');
        if (list.indexOf(email) === -1) list.push(email);
        localStorage.setItem('or_waitlist', JSON.stringify(list));
      } catch (_) {}

      var form = document.getElementById('waitlist-form');
      if (form) form.style.display = 'none';
      var note = document.querySelector('.form-note');
      if (note) note.style.display = 'none';
      var success = document.getElementById('success-msg');
      if (success) success.classList.add('visible');
    }, 650);

    return false;
  }
  window.handleSubmit = handleSubmit;

  (function splash() {
    var modal = document.getElementById('orSplash');
    var closeBtn = document.getElementById('orSplashClose');
    var waitlistBtn = document.getElementById('or-splash-waitlist');
    if (!modal || !closeBtn) return;
    var KEY = 'or_splash_seen_v1';

    function closeSplash() {
      modal.setAttribute('hidden', '');
      document.body.classList.remove('splash-locked');
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    }

    var seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (!seen) {
      modal.removeAttribute('hidden');
      document.body.classList.add('splash-locked');
    }

    closeBtn.addEventListener('click', closeSplash);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeSplash();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeSplash();
    });
    if (waitlistBtn) {
      waitlistBtn.addEventListener('click', function () {
        closeSplash();
        var target = document.getElementById('waitlist');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var email = document.getElementById('email');
        if (email) email.focus();
      });
    }
  })();
})();
