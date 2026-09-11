import React from 'react';

/**
 * The basket a storefront checkout captured, for whoever is about to act on the
 * lead.
 *
 * A landing-page lead is one product in one pack, and every lead screen was
 * built around that: one product card, one price, one pack label. A store lead
 * carries several products and no referral link at all, so those screens render
 * nothing — the agent phones the customer with no idea what was ordered, and
 * the delivery form offers to ship a product nobody bought.
 *
 * Read-only on purpose. Changing a basket line is a real decision (it moves the
 * price the courier collects and the stock that leaves the warehouse) and it
 * belongs on the confirmation call, through the agreed-price field the delivery
 * form already owns.
 */

export interface LeadCartLine {
  productId: number;
  productName?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  variantName?: string | null;
  quantity: number;
  unitPriceMad: number;
  totalPriceMad: number;
}

/** Same defensive read as the server's lib/leadCart.ts — it is a JSON column. */
export function readLeadCart(lead: any): LeadCartLine[] {
  let raw = lead?.cartItems;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((line: any) => line && Number(line.productId) > 0 && Number(line.quantity) > 0)
    .map((line: any) => ({
      productId: Number(line.productId),
      productName: line.productName ?? null,
      sku: line.sku ?? null,
      imageUrl: line.imageUrl ?? null,
      variantName: line.variantName ?? null,
      quantity: Number(line.quantity),
      unitPriceMad: Number(line.unitPriceMad) || 0,
      totalPriceMad: Number(line.totalPriceMad) || 0,
    }));
}

const money = (value: number): string => `${Number(value || 0).toFixed(2)} MAD`;

export default function LeadCartPanel({ lead }: { lead: any }) {
  const lines = readLeadCart(lead);
  if (!lines.length) return null;

  const subtotal = lines.reduce((sum, line) => sum + line.totalPriceMad, 0);
  const shipping = Number(lead?.shippingFeeMad) || 0;
  // What the customer accepted at checkout. The agreed price below overrides it
  // whenever an agent has settled on something else during the call.
  const total = Number(lead?.totalAmountMad) || subtotal + shipping;
  const agreed = lead?.confirmedPriceMad ?? null;
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
        <h2 className="text-white font-bold flex items-center gap-2">🛒 Panier boutique</h2>
        <span className="text-[10px] font-black uppercase tracking-wider text-white/70">
          {lines.length} article{lines.length > 1 ? 's' : ''} · {units} unité{units > 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {lines.map((line, index) => (
          <div key={`${line.productId}-${index}`} className="flex items-center gap-4 px-6 py-3">
            {line.imageUrl ? (
              <img
                src={line.imageUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-gray-100 flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {line.productName || `Produit #${line.productId}`}
              </p>
              <p className="text-[11px] text-gray-400">
                {line.sku ? `SKU: ${line.sku}` : `#${line.productId}`}
                {line.variantName ? ` · ${line.variantName}` : ''}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-black text-gray-900 tabular-nums">{money(line.totalPriceMad)}</p>
              <p className="text-[11px] text-gray-400 tabular-nums">
                {line.quantity} × {money(line.unitPriceMad)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-4 bg-gray-50/70 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Sous-total</span>
          <span className="tabular-nums">{money(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Livraison</span>
          <span className="tabular-nums">{shipping > 0 ? money(shipping) : 'Offerte'}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-200 font-black text-gray-900">
          <span>À encaisser</span>
          <span className="tabular-nums text-indigo-600">{money(agreed !== null ? agreed : total)}</span>
        </div>
        {agreed !== null && Number(agreed) !== Number(total) && (
          <p className="text-[11px] font-bold text-emerald-700 text-right">
            Prix convenu — panier initial {money(total)}
          </p>
        )}
      </div>
    </div>
  );
}
