/**
 * Slider behaviour, as a string. See runtime/checkout.ts for why runtime JS
 * lives inside a .ts file rather than beside it.
 *
 * Scoped per `[data-sl]` element: a page with two sliders is ordinary, and an
 * id-based lookup would drive the first and leave the second with dead arrows.
 *
 * Two things happen here and nothing else. The entrance animation is unblocked
 * when the block scrolls into view, matching the IntersectionObserver in
 * SliderBlock (BlockRenderer.tsx:697-712); and, for the sliding mode, the track
 * is moved. The marquee mode is pure CSS — it returns before any of the
 * navigation work, because there is nothing to drive.
 *
 * Geometry is read from data attributes rather than recomputed, so the compiler
 * and the runtime cannot disagree about how wide a card is.
 */
export const SLIDER_RUNTIME = `
(function(){
  var nodes = document.querySelectorAll('[data-sl]');
  for (var i = 0; i < nodes.length; i++) init(nodes[i]);

  function init(root) {
    if (root.getAttribute('data-sl-ent') === 'on') reveal(root);
    // Marquee scrolls with a CSS animation and has no arrows, dots or autoplay
    // interval — the observer above is the whole of its runtime.
    if (root.getAttribute('data-sl-mq') === 'on') return;

    var track = root.querySelector('[data-sl-track]');
    if (!track) return;

    var items = track.children;
    var dots = root.querySelectorAll('[data-sl-dot]');
    var counter = root.querySelector('[data-sl-n]');
    var per = parseInt(root.getAttribute('data-sl-per'), 10) || 1;
    var gap = parseFloat(root.getAttribute('data-sl-gap')) || 0;
    var fade = root.getAttribute('data-sl-fade') === 'on';
    var zoom = root.getAttribute('data-sl-zoom') === 'on';
    var total = items.length;

    // The start index of each page, ported from BlockRenderer.tsx:715-731. In
    // 'page' mode the last step is clamped so the final page is always full,
    // which is why it can produce a repeat that has to be filtered out.
    var starts = [];
    if (root.getAttribute('data-sl-by') === 'page') {
      for (var p = 0; p < total; p += per) {
        var idx = Math.min(p, Math.max(0, total - per));
        if (starts.indexOf(idx) === -1) starts.push(idx);
      }
    } else {
      for (var c = 0; c <= total - per; c++) starts.push(c);
    }
    if (starts.length === 0) starts.push(0);

    var cur = 0;

    function goTo(n) {
      // Wraps in both directions: the modulo is doubled because JS keeps the
      // sign of the dividend, so -1 % 3 is -1 rather than 2.
      cur = ((n % starts.length) + starts.length) % starts.length;
      paint();
    }
    function next() { goTo(cur + 1); }
    function prev() { goTo(cur - 1); }

    function paint() {
      var start = starts[cur] || 0;
      if (!fade) {
        track.style.transform =
          'translate3d(calc(-' + start + ' * (100% + ' + gap + 'px) / ' + per + '), 0, 0)';
      }
      for (var i = 0; i < items.length; i++) {
        if (fade) items[i].classList.toggle('is-on', i === start);
        else if (zoom) items[i].classList.toggle('is-vis', i >= start && i < start + per);
      }
      for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('is-on', d === cur);
      if (counter) counter.textContent = (cur + 1) + ' / ' + starts.length;
    }

    var arrowPrev = root.querySelector('[data-sl-prev]');
    var arrowNext = root.querySelector('[data-sl-next]');
    // stopPropagation matches the React handlers: the arrows sit inside the
    // block, and a page that made the card itself clickable would otherwise
    // follow the card while the visitor was only paging past it.
    if (arrowPrev) arrowPrev.addEventListener('click', function(e){ e.stopPropagation(); prev(); });
    if (arrowNext) arrowNext.addEventListener('click', function(e){ e.stopPropagation(); next(); });

    for (var k = 0; k < dots.length; k++) {
      (function(n){
        dots[n].addEventListener('click', function(e){ e.stopPropagation(); goTo(n); });
      })(k);
    }

    // React starts the interval whenever there is more than one page, and does
    // not pause it on hover — only the marquee does that.
    if (root.getAttribute('data-sl-auto') === 'on' && starts.length > 1) {
      var speed = parseInt(root.getAttribute('data-sl-speed'), 10) || 4000;
      setInterval(next, speed);
    }
  }

  function reveal(root) {
    // No observer, no animation: show the cards rather than leave them at the
    // opacity:0 the entrance rule starts them at.
    if (!('IntersectionObserver' in window)) { root.classList.add('in-view'); return; }
    var io = new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { root.classList.add('in-view'); io.disconnect(); return; }
      }
    }, { threshold: 0.1 });
    io.observe(root);
  }
})();
`;
