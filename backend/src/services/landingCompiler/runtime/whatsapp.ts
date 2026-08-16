/**
 * WhatsApp widget behaviour, as a string. See runtime/checkout.ts for why
 * runtime JS lives inside a .ts file rather than beside it.
 *
 * Ported from components/public/WhatsAppWidget.tsx. Scoped per `[data-wa]`
 * element, like every other runtime here.
 */
export const WHATSAPP_RUNTIME = `
(function(){
  var widgets = document.querySelectorAll('[data-wa]');
  for (var i = 0; i < widgets.length; i++) init(widgets[i]);

  function init(root) {
    var cfgEl = root.querySelector('[data-wa-cfg]');
    if (!cfgEl) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent || '{}'); } catch (e) { return; }
    if (!cfg.phone) return;

    var toggle = root.querySelector('[data-wa-toggle]');
    var close = root.querySelector('[data-wa-close]');
    var form = root.querySelector('[data-wa-form]');
    var input = root.querySelector('[data-wa-input]');
    var note = root.querySelector('[data-wa-note]');
    var noteX = root.querySelector('[data-wa-note-close]');
    var timeEl = root.querySelector('[data-wa-time]');

    // The message timestamp is the visitor's clock, so it cannot be baked in at
    // compile time — a stored page would show whatever time it was compiled.
    if (timeEl) {
      var now = new Date();
      timeEl.textContent =
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function setOpen(on) {
      root.classList.toggle('open', !!on);
      if (toggle) toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on && input) { try { input.focus({ preventScroll: true }); } catch (e) {} }
    }

    if (toggle) toggle.addEventListener('click', function(){
      setOpen(!root.classList.contains('open'));
    });
    if (close) close.addEventListener('click', function(){ setOpen(false); });
    if (noteX) noteX.addEventListener('click', function(){
      if (note) note.classList.add('gone');
    });

    if (cfg.openOnLoad) setTimeout(function(){ setOpen(true); }, 1500);

    if (form) form.addEventListener('submit', function(e){
      e.preventDefault();

      // Fire-and-forget, and BEFORE the window.open below: opening a new tab can
      // suspend this one, and on iOS it may never resume long enough to send.
      // keepalive lets the request outlive the page either way.
      try {
        fetch('/api/v1/influencer/links/' + encodeURIComponent(cfg.code) + '/track-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          keepalive: true
        }).catch(function(){});
      } catch (e) {}

      var typed = input ? input.value : '';
      var full = [cfg.preSetMessage, typed].filter(Boolean).join('\\n');

      // web.whatsapp.com only makes sense where a desktop browser can show it;
      // wa.me hands off to the app everywhere else. Same 768px cut as React.
      var desktop = window.innerWidth > 768;
      var base = (desktop && cfg.useWebOnDesktop)
        ? 'https://web.whatsapp.com/send'
        : 'https://wa.me';

      window.open(base + '/' + cfg.phone + '?text=' + encodeURIComponent(full), '_blank', 'noopener');
      if (input) input.value = '';
    });
  }
})();
`;
