export interface ImageDimensions {
  width: number;
  height: number;
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
   * Intrinsic dimensions for a local upload, or null.
   *
   * Synchronous and cheap: sharp reads the header only, and results are memoised
   * for the life of the compile. Remote URLs are never fetched — a slow third
   * party host would otherwise block an influencer's save.
   */
  probeImage(url: string): ImageDimensions | null;
}

export interface BlockRenderer {
  type: string;
  /** Emitted once per page when at least one block of this type is present. */
  css?: string;
  /** Emitted once per page, after the body. Return '' when nothing is needed. */
  runtime?: string;
  render(block: any, ctx: BlockContext): string;
}
