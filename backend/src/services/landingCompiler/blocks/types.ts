export interface ImageVariant {
  /** Intrinsic width of the variant file, and its `w` descriptor in srcset. */
  width: number;
  url: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
  /**
   * Narrower re-encodes of the same image that already exist on disk.
   *
   * Empty on the first compile after an upload — generation is deliberately not
   * awaited, so nobody's save waits on sharp. `warmImageCache` re-checks the
   * disk on every later compile, so the next one picks them up.
   */
  variants?: ImageVariant[];
}

export interface ConversionPixel {
  platform: string;
  pixelId: string;
  conversionEvent: string;
}

export interface BlockContext {
  /** Position in the page, so the first block can claim LCP priority. */
  index: number;
  /** Total blocks, for renderers that care about being last. */
  total: number;
  /** Referral code, for anything that has to identify the link client-side. */
  code: string;
  /** Product retail price, the last fallback in the price precedence chain. */
  productPriceMad: number | null;
  /** Pixels active for this link, for firing a conversion on submit. */
  pixels: ConversionPixel[];
  /** landingPage.buttonText — the middle tier of the submit-button label chain. */
  landingButtonText: string | null;
  /**
   * Index of the first express_checkout block, or -1.
   *
   * Only that one carries `id="express-checkout-block"` — the anchor a button
   * scrolls to. React emits the id on every checkout block and relies on
   * getElementById picking the first; duplicating it here would be invalid HTML
   * for no gain.
   */
  firstCheckoutIndex: number;
  /** Influencer display name — default nickname for the WhatsApp widget. */
  influencerName: string | null;
  /** Influencer avatar — default profile image for the WhatsApp widget. */
  influencerAvatar: string | null;
  /**
   * `.pg`'s max-width in px — the widest an image is ever displayed.
   *
   * Needed for a truthful `sizes`: without it the browser assumes full-viewport
   * and picks a candidate far larger than the column can show.
   */
  pageMaxWidth: number;
  /**
   * Intrinsic dimensions for a local upload, or null.
   *
   * Synchronous and cheap: sharp reads the header only, and results are memoised
   * for the life of the compile. Remote URLs are never fetched — a slow third
   * party host would otherwise block an influencer's save.
   */
  probeImage(url: string): ImageDimensions | null;
  /**
   * cloaking.protectVideos — when true, video elements are marked
   * `controlsList="nodownload"` and `disablepictureinpicture` to hide the
   * browser's download/PiP affordances. The right-click guard that pairs with
   * it is emitted once as a runtime script (an inline oncontextmenu attribute
   * would be blocked by the page's hash-based CSP).
   */
  protectVideos: boolean;
}

export interface BlockRenderer {
  type: string;
  /** Emitted once per page when at least one block of this type is present. */
  css?: string;
  /** Emitted once per page, after the body. Return '' when nothing is needed. */
  runtime?: string;
  render(block: any, ctx: BlockContext): string;
}
