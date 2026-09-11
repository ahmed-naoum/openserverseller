/**
 * The site header's only script: the mobile menu toggle.
 *
 * Everything else the header does — sticky positioning, the announcement strip,
 * the desktop navigation, the icon swap between burger and close — is CSS
 * driven off one `data-open` attribute, so nothing here runs until a finger
 * lands on the button. That is deliberate: the header sits above the fold on
 * every page it appears on, and a bar that needs JavaScript to lay itself out
 * is a bar that arrives after the content it is supposed to sit on top of.
 *
 * Delegated from the document rather than bound per header, so a page carrying
 * two of them (a rarity, but the builder permits it) costs one listener.
 */
export const SITE_HEADER_RUNTIME = `
(function(){
  function close(header){
    header.setAttribute('data-open','0');
    var btn = header.querySelector('[data-sh-toggle]');
    if (btn) btn.setAttribute('aria-expanded','false');
  }

  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('[data-sh-toggle]') : null;

    if (btn) {
      var header = btn.closest('.bk-sh');
      if (!header) return;
      var open = header.getAttribute('data-open') === '1';
      header.setAttribute('data-open', open ? '0' : '1');
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      return;
    }

    // A tap anywhere else closes an open menu. Includes the menu's own links:
    // an in-page anchor does not reload, so without this the panel would stay
    // over the section the visitor just asked to see.
    var headers = document.querySelectorAll('.bk-sh[data-open="1"]');
    for (var i = 0; i < headers.length; i++) close(headers[i]);
  }, false);

  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Escape') return;
    var headers = document.querySelectorAll('.bk-sh[data-open="1"]');
    for (var i = 0; i < headers.length; i++) close(headers[i]);
  }, false);
})();
`;
