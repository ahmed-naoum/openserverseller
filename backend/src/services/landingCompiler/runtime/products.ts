/**
 * The products grid/carousel runtime, as a string. See runtime/checkout.ts for
 * why runtime JS lives inside a .ts file rather than beside it.
 *
 * This is the one block whose content is not in the saved page: ProductsBlock
 * (BlockRenderer.tsx:299) fetches `/public/products-by-accounts` on mount and
 * renders whatever comes back. So the compiler ships the shell — skeleton,
 * empty state, styles, and the block's own settings as JSON — and the same
 * request happens here.
 *
 * Resolving the catalogue at compile time was the alternative, and it was
 * rejected: it would bake a product list into a page that is served for up to
 * ten minutes, so a price edit or a deactivated product would keep selling at
 * the old terms. Fetching keeps the list as live as React's.
 *
 * Everything colour-shaped in `cfg` was passed through safeColor at compile
 * time, and every string that comes back from the API is written with
 * textContent — the fetch response is the one input here that no compile-time
 * check has seen.
 */
export const PRODUCTS_RUNTIME = `
(function(){
  var roots = document.querySelectorAll('[data-pr]');
  for (var i = 0; i < roots.length; i++) init(roots[i]);

  function el(tag, cls, css) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (css) n.setAttribute('style', css);
    return n;
  }

  // img.src cannot execute a javascript: URL, but an <img> that silently fails
  // is still better than one pointing anywhere a compromised catalogue asks.
  function safeSrc(url) {
    var v = String(url || '').trim();
    if (!v) return '';
    if (v.charAt(0) === '/') return v;
    return /^https?:\\/\\//i.test(v) ? v : '';
  }

  function init(root) {
    var cfgEl = root.querySelector('script[type="application/json"]');
    var body = root.querySelector('[data-pr-body]');
    if (!cfgEl || !body) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent || '{}'); } catch (e) { return; }
    if (!cfg.accountIds) return;

    fetch('/api/v1/public/products-by-accounts?accountIds=' + encodeURIComponent(cfg.accountIds), {
      headers: { 'Accept': 'application/json' }
    }).then(function(res){
      return res.json();
    }).then(function(data){
      // The two response shapes ProductsBlock accepts, and no other.
      var list = data && data.status === 'success' && data.data
        ? data.data.products
        : (data && data.products) || [];
      draw(root, body, cfg, Array.isArray(list) ? list : []);
    }).catch(function(err){
      // React logs and leaves products at [], which renders the empty state.
      if (window.console && console.error) console.error('Failed to load products for ProductsBlock:', err);
      draw(root, body, cfg, []);
    });
  }

  /** selectedProducts filters AND orders; an empty list means "everything". */
  function pick(cfg, products) {
    if (!cfg.selected || !cfg.selected.length) return products;
    var order = {};
    for (var i = 0; i < cfg.selected.length; i++) order[String(cfg.selected[i].id)] = i;
    return products.filter(function(p){
      return Object.prototype.hasOwnProperty.call(order, String(p.id));
    }).sort(function(a, b){
      return order[String(a.id)] - order[String(b.id)];
    });
  }

  function draw(root, body, cfg, products) {
    var items = pick(cfg, products);
    body.textContent = '';

    if (!items.length) {
      var empty = el('div', 'bk-pr-e');
      var p = el('p');
      p.textContent = cfg.empty;
      empty.appendChild(p);
      body.appendChild(empty);
      return;
    }

    if (cfg.layout !== 'slider') {
      var grid = el('div', 'bk-pr-g g' + cfg.cols);
      for (var i = 0; i < items.length; i++) grid.appendChild(card(cfg, items[i]));
      body.appendChild(grid);
      return;
    }

    if (cfg.anim === 'continuous') marquee(body, cfg, items);
    else carousel(body, cfg, items);
  }

  /** animationType 'continuous': one track, the list twice, shifted by half. */
  function marquee(body, cfg, items) {
    var view = el('div', 'bk-pr-mv');
    var track = el('div', 'bk-pr-mt', 'animation-duration:' + cfg.speedMarquee + 'ms');
    var doubled = items.concat(items);
    for (var i = 0; i < doubled.length; i++) {
      var slot = el('div', 'bk-pr-mi');
      slot.appendChild(card(cfg, doubled[i]));
      track.appendChild(slot);
    }
    view.addEventListener('mouseenter', function(){ track.style.animationPlayState = 'paused'; });
    view.addEventListener('mouseleave', function(){ track.style.animationPlayState = 'running'; });
    view.appendChild(track);
    body.appendChild(view);
  }

  function carousel(body, cfg, items) {
    var wrap = el('div', 'bk-pr-s');
    var view = el('div', 'bk-pr-sv');
    var track = el('div', 'bk-pr-st ' + (cfg.anim === 'smooth' ? 'a-smooth' : cfg.anim === 'bounce' ? 'a-bounce' : 'a-plain'));
    var slots = [];
    for (var i = 0; i < items.length; i++) {
      var slot = el('div', 'bk-pr-si');
      slot.appendChild(card(cfg, items[i]));
      track.appendChild(slot);
      slots.push(slot);
    }
    view.appendChild(track);
    wrap.appendChild(view);
    body.appendChild(wrap);

    var per = 3;
    var cur = 0;
    var hover = false;
    var dotsBox = null;

    // The same three breakpoints ProductsBlock listens for, capped at 3 across
    // however many columns the grid layout was configured with.
    function perView() {
      if (window.innerWidth < 640) return 1;
      if (window.innerWidth < 1024) return 2;
      return Math.min(cfg.cols, 3);
    }
    function maxIndex() { return Math.max(0, items.length - per); }

    function layout() {
      var inset = (16 * (per - 1)) / per;
      for (var i = 0; i < slots.length; i++) {
        slots[i].style.flex = '0 0 calc(100% / ' + per + ' - ' + inset + 'px)';
      }
      track.style.transform =
        'translate3d(calc(-' + cur + ' * (100% + 16px) / ' + per + '), 0, 0)';
      dots();
    }

    function dots() {
      var count = maxIndex() + 1;
      if (items.length <= per) {
        if (dotsBox) { dotsBox.parentNode.removeChild(dotsBox); dotsBox = null; }
        if (arrows.parentNode) wrap.removeChild(arrows);
        return;
      }
      if (!arrows.parentNode) wrap.appendChild(arrows);
      if (!dotsBox) { dotsBox = el('div', 'bk-pr-dots'); wrap.appendChild(dotsBox); }
      if (dotsBox.children.length !== count) {
        dotsBox.textContent = '';
        for (var i = 0; i < count; i++) {
          (function(n){
            var b = el('button');
            b.type = 'button';
            b.setAttribute('aria-label', 'Page ' + (n + 1));
            b.addEventListener('click', function(){ cur = n; layout(); });
            dotsBox.appendChild(b);
          })(i);
        }
      }
      for (var d = 0; d < dotsBox.children.length; d++) {
        var on = d === cur;
        dotsBox.children[d].className = on ? 'is-on' : '';
        dotsBox.children[d].style.background = on ? cfg.btnBg : '';
      }
    }

    function step(dir) {
      var max = maxIndex();
      if (dir > 0) cur = cur >= max ? 0 : Math.min(max, cur + cfg.slideStep);
      else cur = cur <= 0 ? max : Math.max(0, cur - cfg.slideStep);
      layout();
    }

    var arrows = document.createDocumentFragment();
    var left = el('button', 'bk-pr-a l');
    left.type = 'button';
    left.setAttribute('aria-label', 'Précédent');
    left.innerHTML = cfg.chevronLeft;
    left.addEventListener('click', function(){ step(-1); });
    var right = el('button', 'bk-pr-a r');
    right.type = 'button';
    right.setAttribute('aria-label', 'Suivant');
    right.innerHTML = cfg.chevronRight;
    right.addEventListener('click', function(){ step(1); });
    arrows.appendChild(left);
    arrows.appendChild(right);
    // A fragment empties itself once appended, so the removable unit has to be
    // a real element the dots() check can look at.
    var holder = el('div', 'bk-pr-nav');
    holder.appendChild(arrows);
    arrows = holder;

    wrap.addEventListener('mouseenter', function(){ hover = true; });
    wrap.addEventListener('mouseleave', function(){ hover = false; });

    function resize() {
      var n = perView();
      if (n === per) return;
      per = n;
      if (cur > maxIndex()) cur = maxIndex();
      layout();
    }
    window.addEventListener('resize', resize);
    per = perView();
    layout();

    if (cfg.autoPlay) {
      setInterval(function(){
        if (hover) return;
        var max = maxIndex();
        cur = cur >= max ? 0 : Math.min(max, cur + cfg.slideStep);
        layout();
      }, cfg.speed);
    }
  }

  function card(cfg, product) {
    var wrap = el('div', 'bk-pr-c' + (cfg.shadow ? ' ' + cfg.shadow : ''),
      'background:' + cfg.cardBg + ';border-radius:' + cfg.cardRadius + 'px');

    var frame = el('div', 'bk-pr-im');
    var images = product.images || [];
    var src = safeSrc(images[0] && images[0].imageUrl);
    if (src) {
      var img = el('img');
      img.src = src;
      img.alt = product.nameFr || product.nameEn || '';
      img.loading = 'lazy';
      frame.appendChild(img);
    } else {
      var ph = el('div', 'bk-pr-ph');
      ph.innerHTML = cfg.placeholder;
      frame.appendChild(ph);
    }

    var categories = product.categories || [];
    var categoryName = categories[0] ? (categories[0].nameFr || categories[0].nameAr || '') : '';
    if (categoryName) {
      var tag = el('span', 'bk-pr-cat');
      tag.textContent = categoryName;
      frame.appendChild(tag);
    }
    wrap.appendChild(frame);

    var bodyEl = el('div', 'bk-pr-bd');
    var text = el('div', 'bk-pr-tx');
    var h4 = el('h4', null, 'color:' + cfg.titleColor);
    h4.textContent = product.nameFr || product.nameEn || product.nameAr || '';
    var desc = el('p', null, 'color:' + cfg.descColor);
    desc.textContent = product.description || 'Aucune description disponible.';
    text.appendChild(h4);
    text.appendChild(desc);
    bodyEl.appendChild(text);

    var foot = el('div', 'bk-pr-ft');
    if (cfg.showPrice) {
      var row = el('div', 'bk-pr-pr');
      var price = el('span', null, 'color:' + cfg.priceColor);
      price.textContent = (product.retailPriceMad || product.priceMad || 0) + ' MAD';
      row.appendChild(price);
      foot.appendChild(row);
    }

    var conf = null;
    for (var i = 0; cfg.selected && i < cfg.selected.length; i++) {
      if (String(cfg.selected[i].id) === String(product.id)) { conf = cfg.selected[i]; break; }
    }
    var link = (conf && conf.link) || '#express-checkout-block';
    var btn = el('button', 'bk-pr-b',
      'background:' + ((conf && conf.btnBg) || cfg.btnBg) +
      ';color:' + ((conf && conf.btnColor) || cfg.btnColor));
    btn.type = 'button';
    btn.textContent = (conf && conf.buttonText) || 'Commander';
    btn.addEventListener('click', function(){ go(link, product); });
    foot.appendChild(btn);

    bodyEl.appendChild(foot);
    wrap.appendChild(bodyEl);
    return wrap;
  }

  /** handleButtonClick, BlockRenderer.tsx:413-427. */
  function go(link, product) {
    if (!link) return;
    if (link.charAt(0) === '#') {
      var target = document.getElementById(link.slice(1));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      // The checkout listens for this and prices the order from the product the
      // visitor actually clicked. Dispatched even when the anchor is missing,
      // exactly as in React.
      try {
        window.dispatchEvent(new CustomEvent('select-product', { detail: { product: product } }));
      } catch (e) {}
    } else {
      window.open(link, '_blank');
    }
  }
})();
`;
