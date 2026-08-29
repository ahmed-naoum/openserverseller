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
  // --- end-of-video redirect -----------------------------------------------
  // One destination per page in practice, and one guard: whichever video ends
  // first wins, and nothing fires twice.
  var REDIR_KEY = 'sc_vid_redirected';
  var redirecting = false;

  function sourceToken() {
    try {
      var raw = window.location.href + '|' + Date.now();
      var bytes = new TextEncoder().encode(raw);
      var binary = '';
      for (var k = 0; k < bytes.length; k++) binary += String.fromCharCode(bytes[k]);
      // Doubled backslashes, as in runtime/button.ts: this runtime is a template
      // literal, so a single \+ is consumed as an escape and emits /+/g -- an
      // invalid regex that kills the parse of the whole script.
      return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    } catch (e) { return ''; }
  }

  function goTo(url) {
    if (!url || redirecting) return;
    redirecting = true;

    var target = url;
    var token = sourceToken();
    if (token) {
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      target = url + sep + '_s=' + encodeURIComponent(token);
    }

    // Recorded before leaving, for the pageshow guard below.
    try { sessionStorage.setItem(REDIR_KEY, url); } catch (e) {}

    // replace(), never assign(): this page must not survive in history, so Back
    // from the destination reaches whatever preceded the video rather than the
    // video the visitor has already sat through.
    window.location.replace(target);
  }

  // Back-button protection. replace() keeps this page out of history, which
  // handles the ordinary case by itself. This handles the one it cannot: a
  // bfcache restore, which browsers still produce for a cross-origin
  // destination. Having already sent this visitor on, send them on again.
  window.addEventListener('pageshow', function(e){
    if (!e || !e.persisted) return;
    var stored = '';
    try { stored = sessionStorage.getItem(REDIR_KEY) || ''; } catch (err) {}
    if (!stored) return;
    redirecting = false;
    goTo(stored);
  });

  // YouTube and Vimeo render into an iframe, which cannot fire an 'ended' event on an
  // element we own -- the end of playback arrives as a postMessage. Both players
  // stay silent until the parent subscribes, so the handshake is not optional.
  var frames = document.querySelectorAll('[data-vid-redirect]');
  var watchingFrames = false;
  for (var f = 0; f < frames.length; f++) {
    var frame = frames[f].querySelector('iframe');
    if (!frame) continue;
    watchingFrames = true;
    subscribe(frame, frames[f].getAttribute('data-vid-redirect'));
  }

  function subscribe(frame, url) {
    var send = function(){
      var win = frame.contentWindow;
      if (!win) return;
      // Both dialects, unconditionally: the wrong one is ignored, and working
      // out which host we are talking to costs more than sending two messages.
      try { win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*'); } catch (e) {}
      try { win.postMessage(JSON.stringify({ method: 'addEventListener', value: 'ended' }), '*'); } catch (e) {}
      try { win.postMessage(JSON.stringify({ method: 'addEventListener', value: 'finish' }), '*'); } catch (e) {}
    };
    frame.addEventListener('load', send);
    // An iframe already loaded before this script ran never fires load again.
    send();
    frame.setAttribute('data-vid-redirect-to', url || '');
  }

  if (watchingFrames) {
    window.addEventListener('message', function(e){
      var origin = e.origin || '';
      // Substring rather than a regex: see the escaping note in sourceToken.
      if (origin.indexOf('youtube.com') < 0 &&
          origin.indexOf('youtube-nocookie.com') < 0 &&
          origin.indexOf('vimeo.com') < 0) return;

      var data = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (err) { return; }
      }
      if (!data) return;

      // playerState 0 is YouTube's ENDED; Vimeo reports finish/ended by name.
      var ended =
        (data.event === 'infoDelivery' && data.info && data.info.playerState === 0) ||
        data.event === 'finish' ||
        data.event === 'ended';
      if (!ended) return;

      for (var n = 0; n < frames.length; n++) {
        var to = frames[n].getAttribute('data-vid-redirect');
        if (to) { goTo(to); return; }
      }
    });
  }

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

    // An autoplay video ships without the controls attribute, because the
    // unmute overlay is supposed to take over the moment playback begins. When
    // playback never begins -- a rejected play(), a codec the device cannot
    // decode, a stalled network -- that left a spinner turning over a dead
    // player with nothing to tap. Giving the controls back is the only exit.
    var recovered = false;
    function recover() {
      if (recovered) return;
      recovered = true;
      showSpinner(false);
      showUnmute(false);
      v.controls = true;
    }

    // Only armed once we actually start fetching, and cleared as soon as a
    // frame is shown, so a slow connection that eventually plays is unaffected.
    var stallTimer = null;
    function watch() {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(recover, 8000);
    }
    function settled() {
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    }

    v.addEventListener('error', recover);

    // The spinner starts hidden in CSS so a JS-less visitor never sees one that
    // cannot resolve; it is turned on here only once JS is known to be running.
    showSpinner(true);

    v.addEventListener('waiting', function(){ showSpinner(true); });
    v.addEventListener('stalled', function(){ showSpinner(true); });

    function started() {
      playing = true;
      settled();
      showSpinner(false);
      // The overlay only appears once playback is actually under way; showing it
      // over a still-buffering video invites a tap that does nothing.
      if (unmute && v.muted) showUnmute(true);
    }
    v.addEventListener('play', started);
    v.addEventListener('playing', started);

    v.addEventListener('pause', function(){ playing = false; });

    var redirectTo = box.getAttribute('data-vid-redirect');
    v.addEventListener('ended', function(){
      playing = false;
      // A looping video never reaches 'ended', so a redirect configured
      // alongside loop simply never fires -- same as React.
      if (redirectTo) goTo(redirectTo);
    });

    v.addEventListener('volumechange', function(){
      if (!v.muted) showUnmute(false);
    });

    v.addEventListener('timeupdate', function(){
      if (v.currentTime > 0) { settled(); showSpinner(false); }
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
      if (fetch) watch();
      if (fetch && wanted) {
        var p = v.play();
        // A rejection here is the common case on mobile -- a blocked autoplay,
        // or a codec the device declined -- and swallowing it was what left the
        // spinner turning with no way forward.
        if (p && p.catch) p.catch(recover);
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
