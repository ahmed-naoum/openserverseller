/**
 * The storefront cart runtime, for compiled pages.
 *
 * Shares its storage with the React storefront to the byte: the key is
 * `store_cart_<storeId>` and each entry is the CartItem the React
 * CartProvider writes (contexts/CartContext.tsx). A customer who adds to the
 * basket on a compiled product page and then opens /cart — still a React page
 * for now — finds the same basket, because it is the same basket.
 *
 * Two jobs and nothing else: handle add-to-cart / buy-now clicks, and keep the
 * count badge on every site_header cart icon current.
 */
export const CART_RUNTIME = `
(function(){
  function key(storeId){ return 'store_cart_' + storeId; }

  function read(storeId){
    try {
      var raw = localStorage.getItem(key(storeId));
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function write(storeId, items){
    try { localStorage.setItem(key(storeId), JSON.stringify(items)); } catch (e) {}
    badge(items);
  }

  function badge(items){
    var count = 0;
    for (var i = 0; i < items.length; i++) count += Number(items[i].quantity) || 0;
    var icons = document.querySelectorAll('.bk-sh-cart');
    for (var j = 0; j < icons.length; j++) {
      var b = icons[j].querySelector('.bk-sh-badge');
      if (!count) { if (b) b.remove(); continue; }
      if (!b) {
        b = document.createElement('span');
        b.className = 'bk-sh-badge';
        icons[j].appendChild(b);
      }
      b.textContent = String(count);
    }
  }

  function add(storeId, item, qty){
    var items = read(storeId);
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].productId === item.productId && (items[i].variantOptionId || null) === (item.variantOptionId || null)) { found = items[i]; break; }
    }
    if (found) {
      found.quantity = Math.min(99, (Number(found.quantity) || 0) + qty);
      found.totalPriceMad = found.quantity * found.unitPriceMad;
    } else {
      items.push({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || '',
        imageUrl: item.imageUrl || null,
        variantName: item.variantName || null,
        variantOptionId: item.variantOptionId || null,
        quantity: qty,
        unitPriceMad: item.unitPriceMad,
        totalPriceMad: qty * item.unitPriceMad
      });
    }
    write(storeId, items);
  }

  function flash(btn, text){
    var prev = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(function(){ btn.textContent = prev; btn.disabled = false; }, 1200);
  }

  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('[data-cart-add]') : null;
    if (!btn) return;
    var root = btn.closest('[data-pd]');
    var cfgEl = root && root.querySelector('script[type="application/json"]');
    if (!cfgEl) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent || '{}'); } catch (e) { return; }
    if (!cfg.item || !cfg.storeId) return;
    var qtyEl = root.querySelector('[data-cart-qty]');
    var qty = Math.max(1, Math.min(99, parseInt(qtyEl && qtyEl.value, 10) || 1));
    add(cfg.storeId, cfg.item, qty);
    if (btn.getAttribute('data-cart-add') === 'buy') { window.location.href = '/checkout'; return; }
    flash(btn, cfg.added);
  }, false);

  document.addEventListener('click', function(ev){
    var step = ev.target && ev.target.closest ? ev.target.closest('[data-cart-step]') : null;
    if (!step) return;
    var input = step.parentNode.querySelector('[data-cart-qty]');
    if (!input) return;
    var v = parseInt(input.value, 10) || 1;
    v += step.getAttribute('data-cart-step') === '-' ? -1 : 1;
    input.value = String(Math.max(1, Math.min(99, v)));
  }, false);

  // The badge on load, for the count the visitor already has.
  var first = document.querySelector('[data-pd] script[type="application/json"]');
  var any = document.querySelector('[data-store-id]');
  var storeId = any ? any.getAttribute('data-store-id') : null;
  if (!storeId && first) { try { storeId = JSON.parse(first.textContent || '{}').storeId; } catch (e) {} }
  if (storeId) badge(read(storeId));
})();
`;
