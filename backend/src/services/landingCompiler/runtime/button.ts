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

    btn.addEventListener('click', function(){
      if (wrap.hasAttribute('data-btn-checkout')) {
        var target = document.getElementById('express-checkout-block');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      var href = wrap.getAttribute('data-btn-href');
      // Anything not on the allow-list was dropped at compile time, so an empty
      // href means the configured link was unusable — do nothing rather than
      // navigate somewhere unexpected.
      if (href) window.open(href, '_blank', 'noopener');
    });

    // Reveal once a video has played far enough. React listens for the same
    // event, which the video runtime dispatches on timeupdate.
    var after = parseFloat(wrap.getAttribute('data-btn-after') || '0');
    if (after > 0) {
      var onTime = function(e){
        if (e && e.detail && e.detail.currentTime >= after) {
          wrap.classList.remove('pending');
          window.removeEventListener('video-time-update', onTime);
        }
      };
      window.addEventListener('video-time-update', onTime);
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
