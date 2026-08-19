/**
 * Video player behaviour, as a string. See runtime/checkout.ts for why runtime
 * JS lives inside a .ts file rather than beside it.
 *
 * Scoped per `[data-vid]` element so a page with several videos works — the
 * checkout block learned that lesson the expensive way.
 *
 * Only three behaviours are ported, because only three are visible: the
 * buffering spinner, the unmute overlay that autoplay makes necessary, and the
 * `video-time-update` event other blocks listen for. React's isPlaying state
 * exists solely to decide when to show the overlay, so it stays local here.
 */
export const VIDEO_RUNTIME = `
(function(){
  var boxes = document.querySelectorAll('[data-vid]');
  for (var i = 0; i < boxes.length; i++) init(boxes[i]);

  function init(box) {
    var v = box.querySelector('video');
    if (!v) return;

    var spin = box.querySelector('[data-vid-spin]');
    var unmute = box.querySelector('[data-vid-unmute]');
    var playing = false;

    function showSpinner(on) { if (spin) spin.classList.toggle('on', !!on); }
    function showUnmute(on) { if (unmute) unmute.classList.toggle('on', !!on); }

    // The spinner starts hidden in CSS so a JS-less visitor never sees one that
    // cannot resolve; it is turned on here only once JS is known to be running.
    showSpinner(true);

    v.addEventListener('waiting', function(){ showSpinner(true); });
    v.addEventListener('stalled', function(){ showSpinner(true); });

    function started() {
      playing = true;
      showSpinner(false);
      // The overlay only appears once playback is actually under way; showing it
      // over a still-buffering video invites a tap that does nothing.
      if (unmute && v.muted) showUnmute(true);
    }
    v.addEventListener('play', started);
    v.addEventListener('playing', started);

    v.addEventListener('pause', function(){ playing = false; });
    v.addEventListener('ended', function(){ playing = false; });

    v.addEventListener('volumechange', function(){
      if (!v.muted) showUnmute(false);
    });

    v.addEventListener('timeupdate', function(){
      if (v.currentTime > 0) showSpinner(false);
      try {
        window.dispatchEvent(new CustomEvent('video-time-update', {
          detail: { currentTime: v.currentTime }
        }));
      } catch (e) {}
    });

    if (unmute) {
      unmute.addEventListener('click', function(e){
        e.stopPropagation();
        v.muted = false;
        showUnmute(false);
        // Controls are withheld while the overlay is up, so hand them back now.
        if (unmute.getAttribute('data-vid-controls') !== 'off') v.controls = true;
        if (unmute.getAttribute('data-vid-restart') === 'on') v.currentTime = 0;
        var p = v.play();
        if (p && p.catch) p.catch(function(){});
      });
    }

    // The element ships with preload="metadata" and no autoplay attribute, so
    // nothing beyond the header is fetched until the visitor is near the video.
    // Buffering starts one viewport early, which is far enough ahead that the
    // video is ready by the time it is actually on screen.
    var wanted = v.getAttribute('data-vid-auto') === '1';
    var armed = false;

    // fetch is false when playback has already begun by other means: load()
    // would restart the media element and cut that playback off.
    function activate(fetch) {
      if (armed) return;
      armed = true;
      v.preload = 'auto';
      // preload alone does not commit the browser to fetching; load() does.
      if (fetch) { try { v.load(); } catch (e) {} }
      if (fetch && wanted) {
        var p = v.play();
        if (p && p.catch) p.catch(function(){});
      }
    }

    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function(entries){
        for (var j = 0; j < entries.length; j++) {
          if (entries[j].isIntersecting) { io.disconnect(); activate(true); return; }
        }
      }, { rootMargin: '100% 0px' });
      io.observe(box);
    } else {
      // No observer: behave as the page did before, rather than never playing.
      activate(true);
    }

    // Pressing play (or the unmute overlay) beats the observer to it. Fetching
    // is already under way in that case, so only the preload hint is raised.
    v.addEventListener('play', function(){ activate(false); });
  }
})();
`;
