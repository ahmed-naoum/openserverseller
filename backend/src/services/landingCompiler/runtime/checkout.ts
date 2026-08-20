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
    // selectedProductFromBlock (ReferralForm.tsx:47): the product a card in a
    // products block was clicked for. Null on every page without one.
    var fromBlock = null;

    // The price chain, ReferralForm.tsx:500. The pack wins, then the clicked
    // product's two price fields, then the product this link sells. Each step
    // is a plain OR in the original, so a pack priced 0 falls through it.
    function priceNow() {
      return (selected && selected.price) ||
        (fromBlock && fromBlock.retailPriceMad) ||
        (fromBlock && fromBlock.priceMad) ||
        cfg.retailPrice;
    }
    function paintPrice() {
      if (!priceEl) return;
      var shown = priceNow();
      // Skipping the write would leave a stale number on screen that disagrees
      // with what the server will charge.
      if (shown !== null && shown !== undefined && shown !== '') {
        priceEl.textContent = shown + ' MAD';
      }
    }

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

    // The caps the block rendered its maxlength attributes from. Defaults match
    // that object so an older cached page still validates rather than treating
    // every limit as zero.
    var lim = cfg.lim || {};
    function cap(k, d) { var n = Number(lim[k]); return n > 0 ? n : d; }
    var NAME_MIN = cap('nameMin', 2), NAME_MAX = cap('nameMax', 60);
    var CITY_MIN = cap('cityMin', 2), CITY_MAX = cap('cityMax', 40);
    var PHONE_MIN = cap('phoneMinDigits', 9), PHONE_MAX = cap('phoneMaxDigits', 14);
    var ADDR_MIN = cap('addressMin', 5), ADDR_MAX = cap('addressMax', 200);

    // Arabic (incl. the Supplement and Extended-A ranges Moroccan names use) and
    // Latin letters. Counting letters, not characters, is what separates a real
    // name from "..." or "-- --": the digit stripper already removes numbers, so
    // punctuation is the only thing that can reach a length check intact.
    function letters(s) { return (s.match(/[A-Za-z\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\u00C0-\\u024F]/g) || []).length; }

    /**
     * One validator per field, returning a message or null. Blur, live
     * correction and submit all call these, so a field can never pass one path
     * and fail another.
     */
    var checks = {
      fullName: function(v) {
        var s = v.trim();
        if (!s) return cfg.msg.nameRequired;
        if (s.length < NAME_MIN) return cfg.msg.nameShort;
        if (letters(s) < 2) return cfg.msg.nameLetters || cfg.msg.nameShort;
        if (s.length > NAME_MAX) return cfg.msg.nameLong || cfg.msg.nameShort;
        return null;
      },
      phone: function(v) {
        if (!v.trim()) return cfg.msg.phoneRequired;
        // The effective rule in ReferralForm is 9-14 ASCII digits anywhere: the
        // Moroccan pattern is OR-ed with it, and every string it accepts already
        // has 10-12 digits. Tightening this would start rejecting leads that
        // convert today.
        var digits = toAscii(v).replace(/\\D/g, '');
        if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) return cfg.msg.phoneInvalid;
        return null;
      },
      city: function(v) {
        var s = v.trim();
        if (!s) return cfg.msg.cityRequired;
        if (s.length < CITY_MIN) return cfg.msg.cityShort;
        if (letters(s) < 2) return cfg.msg.cityLetters || cfg.msg.cityShort;
        if (s.length > CITY_MAX) return cfg.msg.cityLong || cfg.msg.cityShort;
        return null;
      },
      // Optional stays optional: an empty address is valid, and only a filled
      // one is held to a shape. Call-centre agents collect it on the
      // confirmation call, so requiring it would reject orders both the form
      // and POST /public/leads accept.
      address: function(v) {
        var s = v.trim();
        if (!s) return null;
        if (s.length < ADDR_MIN) return cfg.msg.addressShort;
        if (s.length > ADDR_MAX) return cfg.msg.addressLong;
        return null;
      }
    };

    function validate(key) {
      var el = f[key];
      if (!el) return null;
      return checks[key](el.value || '');
    }

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

    // Checked on the way out of a field, so a mistake is caught next to the
    // field that caused it rather than at the bottom of the form. An empty
    // field that has not been touched yet stays silent — nagging a customer
    // who is still filling the form in costs orders.
    ['fullName','phone','city','address'].forEach(function(k){
      var el = f[k];
      if (!el) return;
      el.addEventListener('blur', function(){
        if (!(el.value || '').trim()) { clearError(el); return; }
        var msg = validate(k);
        if (msg) fieldError(el, msg); else clearError(el);
      });
    });

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
      // They carry role="radio" and tabindex="0", so a keyboard user expects
      // Enter and Space to choose one.
      el.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          el.click();
        }
      });
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
        paintPrice();
      });
    });

    // A products block dispatches this when a card's button points at the
    // checkout anchor (BlockRenderer.tsx:422). React answers it by re-pricing
    // the header and relabelling the order; without this the compiled page
    // would scroll here and then sell the link's own product instead.
    window.addEventListener('select-product', function(e){
      var picked = e && e.detail ? e.detail.product : null;
      if (!picked) return;
      fromBlock = picked;
      paintPrice();
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

    // What the order is recorded as, ReferralForm.tsx:350-352. A card click
    // makes it "Product (Pack)"; with no card it is the pack name alone, and
    // absent entirely when the block has no packs.
    function variant() {
      if (!fromBlock) return selected ? selected.name : undefined;
      var name = fromBlock.nameFr || fromBlock.nameEn || fromBlock.nameAr;
      return name + ' (' + ((selected && selected.name) || 'Standard') + ')';
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      clearAll();

      var name = (f.fullName ? f.fullName.value : '').trim();
      var city = (f.city ? f.city.value : '').trim();
      var phoneRaw = f.phone ? f.phone.value : '';
      // Sent trimmed: a trailing space is invisible to the customer but reaches
      // the call-centre agent as part of the address.
      var address = (f.address ? f.address.value : '').trim();

      // Every field, in the order they appear on screen, so the message in the
      // strip belongs to the first problem the customer would see. Each field
      // is marked, not just the first — one round trip, not four.
      var first = null;
      var firstEl = null;
      ['fullName','phone','city','address'].forEach(function(k){
        var msg = validate(k);
        if (!msg) { clearError(f[k]); return; }
        fieldError(f[k], msg);
        if (!first) { first = msg; firstEl = f[k]; }
      });

      if (first) {
        topError(first);
        // Focus the field, not just the message: on a phone the strip and the
        // offending field are rarely on screen together.
        if (firstEl && firstEl.focus) { try { firstEl.focus({ preventScroll: true }); } catch (e) { firstEl.focus(); } }
        if (firstEl && firstEl.scrollIntoView) firstEl.scrollIntoView({ block: 'center' });
        return;
      }

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
          productVariant: variant()
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

        // Confirm immediately, then navigate. The panel is only on screen for a
        // moment, but without it the button sits in its "sending" state for the
        // whole delay below and looks stuck.
        form.style.display = 'none';
        var packs = root.querySelector('[data-ck="packs"]');
        if (packs) packs.style.display = 'none';
        if (panel) { panel.style.display = 'block'; panel.scrollIntoView({ block: 'center' }); }

        // A short delay before unloading, because the conversion pixels fired
        // just above are in flight. React could navigate instantly — its router
        // never unloaded the document, so those requests always completed. A
        // real navigation cancels them, which would lose the Purchase/Lead event
        // this whole page exists to record.
        setTimeout(function(){
          // replace(), not assign(): matches navigate(..., { replace: true }), so
          // Back does not return to a form that would resubmit.
          location.replace(cfg.thankYouUrl || '/thank-you');
        }, cfg.thankYouDelayMs);
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
