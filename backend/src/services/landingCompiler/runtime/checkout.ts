/**
 * The checkout form's browser runtime, as a string.
 *
 * Kept in a .ts file rather than a .js sibling on purpose: the backend builds
 * with plain `tsc`, which does not copy non-TypeScript files into dist/. A
 * runtime/checkout.js next to this would compile locally and be silently absent
 * in production.
 *
 * Everything is scoped to a `[data-ck-root]` element rather than looked up by
 * id. A page may legitimately contain more than one express_checkout block —
 * the builders impose no limit — and id-based lookup would wire up only the
 * first, leaving the second with no submit handler at all. Since the form
 * carries `novalidate` and its inputs have no `name`, clicking that dead
 * button would perform a native GET and silently discard the order.
 *
 * Written to match ReferralForm.tsx, quirks included. Where the React behaviour
 * is odd the comment says so rather than the code fixing it: a rendering rewrite
 * and a behaviour change landing together would make any movement in conversion
 * impossible to attribute.
 */
export const CHECKOUT_RUNTIME = `
(function(){
  var roots = document.querySelectorAll('[data-ck-root]');
  for (var r = 0; r < roots.length; r++) init(roots[r]);

  function init(root) {
    var cfgEl = root.querySelector('script[type="application/json"]');
    if (!cfgEl) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent || '{}'); } catch (e) { return; }

    var form = root.querySelector('form');
    if (!form) return;

    var f = {
      fullName: root.querySelector('[data-ck="name"]'),
      phone: root.querySelector('[data-ck="phone"]'),
      city: root.querySelector('[data-ck="city"]'),
      address: root.querySelector('[data-ck="address"]')
    };
    var btn = root.querySelector('[data-ck="submit"]');
    var strip = root.querySelector('[data-ck="strip"]');
    var panel = root.querySelector('[data-ck="success"]');
    var priceEl = root.querySelector('[data-ck="price"]');
    var selected = cfg.packs && cfg.packs.length ? cfg.packs[0] : null;

    // Eastern Arabic digits only. React maps this range and no other, then
    // strips everything outside [0-9+ -], so Persian digits are removed rather
    // than converted. Mapping them here would silently widen what is accepted.
    function toAscii(s) {
      return s.replace(/[\\u0660-\\u0669]/g, function(d){
        return String(d.charCodeAt(0) - 0x0660);
      });
    }

    // handleNameChange / handleCityChange strip digits as typed, which is why
    // the "must not contain digits" error is unreachable in the original.
    function stripDigits(s) { return s.replace(/[0-9\\u0660-\\u0669]/g, ''); }

    function onInput(el, fn) {
      if (!el) return;
      el.addEventListener('input', function(){
        if (fn) { var v = fn(this.value); if (v !== this.value) this.value = v; }
        clearError(el);
      });
    }
    onInput(f.fullName, stripDigits);
    onInput(f.city, stripDigits);
    // Mapping first, then the character filter — the order matters, or a mapped
    // digit would be stripped before it could become ASCII.
    onInput(f.phone, function(v){ return toAscii(v).replace(/[^0-9+\\s-]/g, ''); });
    onInput(f.address, null);

    function slotFor(el) {
      return el && el.parentNode ? el.parentNode.querySelector('[data-ck-err]') : null;
    }
    function fieldError(el, msg) {
      if (!el) return;
      el.setAttribute('aria-invalid', 'true');
      var slot = slotFor(el);
      if (slot) { slot.textContent = msg; slot.style.display = 'block'; }
    }
    function clearError(el) {
      if (!el) return;
      el.removeAttribute('aria-invalid');
      var slot = slotFor(el);
      if (slot) { slot.textContent = ''; slot.style.display = 'none'; }
    }
    function clearAll() {
      ['fullName','phone','city','address'].forEach(function(k){ clearError(f[k]); });
      if (strip) { strip.textContent = ''; strip.style.display = 'none'; }
    }
    function topError(msg) {
      if (!strip) return;
      strip.textContent = msg;
      strip.style.display = 'block';
      strip.scrollIntoView({ block: 'nearest' });
    }

    // Scoped to the root, not the form: the pack list renders above the form
    // element, so form.querySelectorAll would find nothing and every order
    // would be priced at whichever pack happened to be first.
    var packEls = root.querySelectorAll('[data-pack]');
    Array.prototype.forEach.call(packEls, function(el){
      el.addEventListener('click', function(){
        var id = el.getAttribute('data-pack');
        for (var i = 0; i < cfg.packs.length; i++) {
          if (String(cfg.packs[i].id) === id) { selected = cfg.packs[i]; break; }
        }
        Array.prototype.forEach.call(packEls, function(other){
          var on = other === el;
          other.classList.toggle('is-on', on);
          other.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        // Mirrors the React precedence chain: the pack price, else the product
        // retail price. Skipping the write would leave a stale number on screen
        // that disagrees with what the server will charge.
        if (priceEl && selected) {
          var shown = selected.price || cfg.retailPrice;
          if (shown !== null && shown !== undefined && shown !== '') {
            priceEl.textContent = shown + ' MAD';
          }
        }
      });
    });

    function track() {
      if (!cfg.pixels) return;
      for (var i = 0; i < cfg.pixels.length; i++) {
        var p = cfg.pixels[i];
        var ev = p.conversionEvent || 'Lead';
        try {
          if (p.platform === 'META' && window.fbq) {
            window.fbq('track', ev);
          } else if (p.platform === 'GOOGLE' && window.gtag) {
            window.gtag('event', ev, { 'event_category': 'conversion' });
          } else if (p.platform === 'TIKTOK' && window.ttq) {
            window.ttq.track(ev === 'Purchase' ? 'CompletePayment' : 'CompleteRegistration');
          } else if (p.platform === 'SNAPCHAT' && window.snaptr) {
            window.snaptr('track', ev === 'Purchase' ? 'PURCHASE' : 'SIGN_UP');
          }
        } catch (e) {}
      }
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      clearAll();

      var name = (f.fullName ? f.fullName.value : '').trim();
      var city = (f.city ? f.city.value : '').trim();
      var phoneRaw = f.phone ? f.phone.value : '';
      // Address is NOT validated. React renders it as an optional textarea and
      // the server requires only referralCode, fullName and phone — blocking on
      // it here would reject orders both sides accept.
      var address = f.address ? f.address.value : '';

      var first = null;

      if (!name) { fieldError(f.fullName, cfg.msg.nameRequired); first = first || cfg.msg.nameRequired; }
      else if (name.length < 2) { fieldError(f.fullName, cfg.msg.nameShort); first = first || cfg.msg.nameShort; }

      if (!city) { fieldError(f.city, cfg.msg.cityRequired); first = first || cfg.msg.cityRequired; }
      else if (city.length < 2) { fieldError(f.city, cfg.msg.cityShort); first = first || cfg.msg.cityShort; }

      // The effective rule in ReferralForm is 9-14 ASCII digits anywhere: the
      // Moroccan pattern is OR-ed with it, and every string it accepts already
      // has 10-12 digits. Tightening this would start rejecting leads that
      // convert today.
      var digits = phoneRaw.replace(/\\D/g, '');
      if (!phoneRaw.trim()) { fieldError(f.phone, cfg.msg.phoneRequired); first = first || cfg.msg.phoneRequired; }
      else if (digits.length < 9 || digits.length > 14) {
        fieldError(f.phone, cfg.msg.phoneInvalid); first = first || cfg.msg.phoneInvalid;
      }

      if (first) { topError(first); return; }

      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = cfg.msg.sending;

      fetch('/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: cfg.code,
          fullName: name,
          phone: phoneRaw.trim(),
          city: city,
          address: address,
          productVariant: selected ? selected.name : undefined
        })
      }).then(function(res){
        // A 502 from nginx or an offline network yields a non-JSON body; without
        // this the parse error itself would be shown to the customer.
        return res.json().catch(function(){ return null; }).then(function(body){
          return { ok: res.ok, body: body };
        });
      }).then(function(r){
        if (!r.ok) {
          var e2 = new Error((r.body && r.body.message) || cfg.msg.failed);
          e2.fromServer = true;
          throw e2;
        }
        track();
        form.style.display = 'none';
        var packs = root.querySelector('[data-ck="packs"]');
        if (packs) packs.style.display = 'none';
        if (panel) { panel.style.display = 'block'; panel.scrollIntoView({ block: 'center' }); }
        // Replaces navigate('/thank-you'): a refresh must not look like a resubmit.
        try { history.replaceState(null, '', location.pathname + '?ok=1'); } catch (e) {}
      }).catch(function(err){
        // Only a message the server actually sent is safe to show; anything else
        // is a browser-internal string the customer cannot act on.
        topError(err && err.fromServer && err.message ? err.message : cfg.msg.failed);
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  }
})();
`;
