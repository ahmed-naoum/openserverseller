/**
 * Voice-note player behaviour, as a string. See runtime/checkout.ts for why
 * runtime JS lives inside a .ts file rather than beside it.
 *
 * Scoped per `[data-au]` element, like every other runtime here — a page with
 * eight testimonial notes on it is the normal case, not the edge case.
 *
 * The waveform is the only unusual part: React re-renders 32 spans on every
 * timeupdate to recolour the passed ones. Here the spans are emitted once at
 * compile time with their heights baked in, and the runtime only ever writes
 * `style.background`, which is the same paint work without the diffing.
 */
export const AUDIO_RUNTIME = `
(function(){
  var nodes = document.querySelectorAll('[data-au]');
  for (var i = 0; i < nodes.length; i++) init(nodes[i]);

  // formatAudioTime, BlockRenderer.tsx:1638. NaN before metadata loads is the
  // normal first state, not an error.
  function fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ':' + (x < 10 ? '0' : '') + x;
  }

  function init(root) {
    var a = root.querySelector('audio');
    if (!a) return;

    var play = root.querySelector('[data-au-play]');
    var wave = root.querySelector('[data-au-wave]');
    var cur = root.querySelector('[data-au-cur]');
    var dur = root.querySelector('[data-au-dur]');
    var speed = root.querySelector('[data-au-speed]');
    var bars = wave ? wave.children : [];
    var active = root.getAttribute('data-au-active') || '#34B7F1';
    var rates = [1, 1.5, 2];
    var rate = 0;

    function paint() {
      var d = a.duration;
      var frac = d > 0 ? a.currentTime / d : 0;
      for (var i = 0; i < bars.length; i++) {
        bars[i].style.background = (i + 1) / bars.length <= frac ? active : '#cbd5e1';
      }
      if (cur) cur.textContent = fmt(a.currentTime);
    }

    a.addEventListener('loadedmetadata', function(){
      // Only overwrite the placeholder once a real duration exists; a failed
      // load would otherwise replace "0:35" with "0:00".
      if (dur && isFinite(a.duration) && a.duration > 0) dur.textContent = fmt(a.duration);
      paint();
    });
    a.addEventListener('timeupdate', paint);
    a.addEventListener('play', function(){ if (play) play.classList.add('on'); });
    a.addEventListener('pause', function(){ if (play) play.classList.remove('on'); });
    a.addEventListener('ended', function(){
      if (play) play.classList.remove('on');
      a.currentTime = 0;
      paint();
    });

    if (play) play.addEventListener('click', function(e){
      e.stopPropagation();
      if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function(){}); }
      else a.pause();
    });

    if (wave) wave.addEventListener('click', function(e){
      e.stopPropagation();
      var d = a.duration;
      if (!d || !isFinite(d)) return;
      var r = wave.getBoundingClientRect();
      if (!r.width) return;
      var f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      a.currentTime = f * d;
      paint();
    });

    if (speed) speed.addEventListener('click', function(e){
      e.stopPropagation();
      rate = (rate + 1) % rates.length;
      a.playbackRate = rates[rate];
      speed.textContent = rates[rate] + 'x';
    });

    // Safari rejects the autoplay attribute in some states and honours only an
    // explicit call. Same treatment the video runtime gives it.
    if (a.autoplay) { var p = a.play(); if (p && p.catch) p.catch(function(){}); }
  }
})();
`;
