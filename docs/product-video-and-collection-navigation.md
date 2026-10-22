# Product videos and collection navigation

## Admin: homepage opt-in

In **Shop → Products → Content**, upload the optional product video, then explicitly enable **Show video in homepage Shop by Video** if it should appear on the homepage. The checkbox defaults to off. The product must be published and have a video. Leaving it off does not remove the video from its product detail page.

Saving an opted-in product adds/updates its linked homepage reel. Opting out, unpublishing or removing the video removes linked reels; deleting a product removes them too. Nested Payload operations now share the request/transaction. Standalone reels manually curated under Homepage remain supported. The homepage independently filters linked reels by current eligibility, so legacy auto-added entries cannot bypass the new opt-in before products are next saved.

**Existing products are not automatically opted in.** Enable the checkbox and save each product that should remain in Shop by Video. No production data has been rewritten by this implementation. MongoDB needs no schema migration. A PostgreSQL migration (`20261022_000000_shop_by_video_opt_in`) is included for installations using that adapter with migrations; apply it through your normal deployment workflow before serving the new code. SQLite installations need the new boolean column via their own schema-push/migration workflow. Do not run PostgreSQL migrations against MongoDB or SQLite.

## Collection sidebar

Main Categories and Subcategories have separate lists. Subcategory entries show their parent name for context. Existing hierarchy-aware product filtering stays intact. Switching categories resets the old pagination page but retains search/sort; changing sort also retains query-string category filters.

## Product page floating reel

For products with a video, a compact bottom-left reel attempts muted playback on arrival and loops automatically. When at least 15% of the inline video slot enters the viewport, the same video docks into that slot and continues playing. Leaving the slot brings it back into the floating position. A stable portal host preserves the video element, playback position, sound setting and buffered media rather than running two players or restarting the video. The slot reserves its space to prevent layout jumps.

Controls provide play/pause and sound in both positions, plus expand/minimize and close while floating. An explicit pause is preserved across scrolling. Close dismisses the floating view for the current product, but the video still plays in its inline section when visible. Without JavaScript, a native-control inline video remains available. There is no floating player when the product has no video.

The player sits below modal/header layers and above the mobile bottom navigation, including safe-area spacing. It pauses/hides while a modal/scroll lock is active or the page is hidden. On mobile, only the floating view hides while the purchase button is visible. Reduced-motion and data-saving preferences disable automatic playback/preloading until the user explicitly plays. Autoplay rejection leaves a manual play button; video failure removes the player and displays an inline unavailable message without breaking shopping. Browsers may still prevent autoplay.

The Nureh reference URL could not be accessed by the available browsing tools; this is an implementation of the requested behavior, not a verified pixel-identical recreation.

## Verification

Vitest regression tests cover sync eligibility and cleanup, legacy visibility, shared request propagation, sidebar separation/filter preservation, muted playback, autoplay rejection, reduced-motion/data-saving, mobile safe-area positioning, purchase-button avoidance, inline-player handoff, modal suppression and failures. Before release, smoke-test real iOS/Android video autoplay, actual R2 video playback, mobile cart/gallery overlays and the new checkbox against a staging database. Browser media policies and responsive layout cannot be fully validated with DOM mocks alone.
