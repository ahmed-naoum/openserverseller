# Homepage Android download

Implemented in `C:\Users\Victus\Desktop\vegas\frontend`. This is a local website update, not a production deployment.

## Experience

- A navy and coral mobile-app section before the success stories, linked from desktop/mobile navigation and the footer.
- French, English, and Arabic copy with right-to-left layout support.
- Interactive, explicitly illustrative phone previews for orders, statistics, and links. Motion respects reduced-motion preferences. No claim that the downloadable build supports closed-app push.
- Direct APK download with real file size/version and compatibility information, a desktop QR panel, an installation guide, and an iPhone web alternative.
- Native anchors and disclosure elements, keyboard focus styles, accessible feature buttons, lazy-loaded artwork, and scoped CSS.

## Downloaded binary

Source: `C:\Users\Victus\Desktop\mobile silacod.com\android\app\build\outputs\apk\release\app-release.apk`.

Published file in the website source: `public/downloads/silacod-1.0.0-android-arm64.apk`.

- Package: `com.silacod.mobile`
- Version: 1.0.0 / version code 1
- Minimum Android: 7.0 (SDK 24)
- Architecture: arm64-v8a only
- Size: 45,272,154 bytes (45.3 MB)
- SHA-256: `9ef7f54e13343f2e86dde9491c20cd92f916617834f08eb0de0e3d257ff0ac4f`

The existing APK is labelled a preview. It is not a newly rebuilt app or a store-approved release. The Firebase/UI changes from the mobile source are not necessarily in this older binary. Only this APK and explicit public assets were copied; Firebase server credential files were not included in the website.

Release metadata lives in `src/components/home/mobileAppRelease.ts` and a matching public JSON file. Update both with the APK when issuing a new version. Use a new filename so a browser/CDN cannot serve an older binary from cache. Keep the signing certificate consistent for in-place updates.

## Deployment

The website's normal build copies `public/downloads` and `public/images/mobile-app` into its output. Include those files when deploying the updated frontend. No backend route is needed.

Expected public URLs after deployment:

- `https://silacod.com/#application` (also encoded in the QR)
- `https://silacod.com/downloads/silacod-1.0.0-android-arm64.apk`

The live site has not been changed by this task. Confirm the production server returns the APK bytes, not the SPA's HTML fallback. Prefer MIME type `application/vnd.android.package-archive` (or `application/octet-stream`) and `Content-Disposition: attachment` for the download location; missing files should return 404. Preserve normal HTTPS and browser protections. The PWA configuration excludes downloads from precaching and navigation fallback, so the 45 MB APK is not fetched for every homepage visitor.

## Validation

- Frontend TypeScript check passed.
- Vite production bundle and PWA generation passed. The existing large-chunk and stale Browserslist warnings are unrelated to this section.
- Static rendering completed for all 10 configured public routes.
- Browser checks: desktop and phone layout, French/English/Arabic, feature switching, QR disclosure, installation guide, mobile-menu app link, and real download event.
- Downloaded the APK over local HTTP: status 200, exact length and SHA-256 match. Verified the production output contains the APK and the service worker does not precache it.
- No full application regression test or production deployment was performed. The new website section does not modify the installed phone app.

## Artwork and source files

Built-in image generation was used for the original decorative artwork. It was converted to a 36.7 KB WebP for the website. Icons use the existing Lucide vector library; the phone interface is responsive HTML with labelled demonstration data.

Final artwork: `C:\Users\Victus\Desktop\vegas\frontend\public\images\mobile-app\commerce-orbit.webp`

Final QR: `C:\Users\Victus\Desktop\vegas\frontend\public\images\mobile-app\download-qr.png`

Component and styles: `src/components/home/MobileAppDownload.tsx` and `MobileAppDownload.css`.

Generation prompt:

Use case: ads-marketing. Asset type: premium website section artwork for SILACOD, a Moroccan mobile commerce management app. Create a refined cinematic 3D still life, square 1024x1024 composition: a softly illuminated brushed coral-orange sculptural orbital ribbon arcs around a small floating ivory parcel cube, with two small rounded glass tiles and a single coral sphere. The objects form an open crescent in the RIGHT and LOWER half, leaving the CENTER largely uncluttered so a real HTML phone preview can be layered over it. Deep midnight navy #171b3d studio background, burnt orange #ff663d and creamy white objects, delicate lavender rim lighting, subtle surface grain and realistic soft shadows. Minimal editorial product advertising, sophisticated calm energy, elegant generous negative space, beautifully restrained materials. No text, no letters, no numbers, no logo, no phone, no fake interface, no currency, no watermark, no stars or sparkles. The entire canvas should have dark navy background edge to edge; avoid borders.
