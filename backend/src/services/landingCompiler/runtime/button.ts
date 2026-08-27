/**
 * Button behaviour, as a string. See runtime/checkout.ts for why runtime JS
 * lives inside a .ts file rather than beside it.
 *
 * Three behaviours, all of them in ButtonBlockComponent:
 *   - click: scroll to the checkout, or open a link in a new tab
 *   - sticky buttons hide while the checkout is on screen, so the fixed CTA does
 *     not cover the form it is pointing at
 *   - a button with showAfterVideoSeconds stays hidden until a video block
 *     reports having played that long
 */
export const BUTTON_RUNTIME = `
(function(){
  var buttons = document.querySelectorAll('[data-btn]');
  if (!buttons.length) return;

  for (var i = 0; i < buttons.length; i++) bind(buttons[i]);

  function bind(wrap) {
    var btn = wrap.querySelector('button');
    if (!btn) return;

    var maxClicks = parseInt(wrap.getAttribute('data-btn-max-clicks') || '0', 10);
    var btnId = wrap.getAttribute('data-btn-id') || 'btn';
    var storageKey = 'sc_btn_clicks_' + btnId;

    if (maxClicks > 0) {
      var currentClicks = parseInt(localStorage.getItem(storageKey) || '0', 10);
      if (currentClicks >= maxClicks) {
        wrap.style.display = 'none';
        return;
      }
    }

    btn.addEventListener('click', function(){
      if (maxClicks > 0) {
        var currentClicks = parseInt(localStorage.getItem(storageKey) || '0', 10) + 1;
        try { localStorage.setItem(storageKey, String(currentClicks)); } catch (_) {}
        if (currentClicks >= maxClicks) {
          wrap.style.display = 'none';
        }
      }

      if (wrap.hasAttribute('data-btn-checkout')) {
        var target = document.getElementById('express-checkout-block');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      var href = wrap.getAttribute('data-btn-href');
      // Anything not on the allow-list was dropped at compile time, so an empty
      // href means the configured link was unusable — do nothing rather than
      // navigate somewhere unexpected.
      if (href) {
        if (wrap.hasAttribute('data-btn-send-token')) {
          try {
            var raw = window.location.href + '|' + Date.now();
            var bytes = new TextEncoder().encode(raw);
            var binary = '';
            for (var j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
            var token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            var sep = href.indexOf('?') >= 0 ? '&' : '?';
            href = href + sep + '_s=' + encodeURIComponent(token);
          } catch (_) {}
        }
        window.open(href, '_blank', 'noopener');
      }
    });

    // Reveal once a video has played far enough. React listens for the same
    // event, which the video runtime dispatches on timeupdate.
    var after = parseFloat(wrap.getAttribute('data-btn-after') || '0');
    if (after > 0) {
      var revealed = false;
      var reveal = function(){
        if (revealed) return;
        revealed = true;
        wrap.classList.remove('pending');
        window.removeEventListener('video-time-update', onTime);
      };
      var onTime = function(e){
        if (e && e.detail && e.detail.currentTime >= after) reveal();
      };
      window.addEventListener('video-time-update', onTime);

      // Only a <video> element reports progress. YouTube and Vimeo render an
      // iframe, which cannot, and a page may carry a delayed button with no
      // video at all — in both cases the event never arrives and React leaves
      // the button permanently invisible. A configured call-to-action that no
      // customer can ever see is lost orders, so fall back to a timer from page
      // load. Pages that do have a real <video> keep the original behaviour.
      //
      // The second arm covers autoplay videos specifically. They used to carry
      // the HTML autoplay attribute and so began at page load, which made this
      // reveal a page-load timer in all but name. They now wait until the
      // visitor scrolls near them, so without this a delayed CTA placed above a
      // far-down video would never appear at all. Manually played videos are
      // untouched: there the delay is meant to track watch time.
      if (!document.querySelector('video') || document.querySelector('video[data-vid-auto]')) {
        setTimeout(reveal, after * 1000);
      }
    }
  }

  // A sticky CTA covering the form it points at is worse than no CTA, so it is
  // hidden while the checkout is in view. Thresholds match the React observer.
  var sticky = document.querySelectorAll('[data-btn-sticky]');
  if (!sticky.length || !window.IntersectionObserver) return;

  var checkout = document.getElementById('express-checkout-block');
  if (!checkout) return;

  new IntersectionObserver(function(entries){
    var inView = entries[0] && entries[0].isIntersecting;
    for (var i = 0; i < sticky.length; i++) {
      sticky[i].classList.toggle('off', !!inView);
    }
  }, { threshold: 0.01, rootMargin: '0px 0px -50px 0px' }).observe(checkout);
})();
`;
