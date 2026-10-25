# Sprint 23D — mobile navigation pilot

Approved reference: [Figma A2, collapsed and expanded](https://www.figma.com/design/gFQSLkSSh3LZ0fHTWr06DT/compra-car?node-id=255-2).

## Behavior

- Below 1024 px: the existing desktop navigation content opens as a modal overlay from the left. No permanent icon rail and no content displacement.
- The floating toggle now uses the existing official four-squircle logo, `apps/web/public/carboot/icon_logo_official.svg`, rendered at 44 × 44 px, following the mobile review. The original menu asset is retained for history.
- A flat graphite `#1A1D21` circle, 64 × 64 px, sits 20 px from the left and 24 px above the bottom safe area. No shadow or gradient. When expanded, the same button moves to the right of the drawer.
- The panel is 264 px wide, constrained on smaller screens to leave room for the 64 px close button and margins. Backdrop: black at 38% opacity.
- Panel/button use 300 ms easing; the backdrop fades in/out. Reduced-motion preference disables transitions.
- Outside tap, the menu button, Escape, a link selection, route changes or switching to desktop close the drawer. Native dialog contains focus and makes the background inert. Page scrolling is restored on close/unmount.
- The navigation area scrolls independently. Account opens upward within a scrollable region; child links and account actions have 44 px touch targets. Safe areas protect controls in standalone PWA mode.
- Desktop remains the existing hover-expanding sidebar. Both sizes use the same account-tier link policy; server permissions are unchanged.

## QA checklist

Use fresh sessions for Visitor, Public, Corporate, Admin and Master. Check at 320, 390, 768 and 1440 px, plus a short landscape viewport.

1. Below 1024 px, only the floating navigation trigger appears; no old navigation topbar or permanent icon rail.
2. Open/close repeatedly and quickly. The page does not shift, the animation remains smooth, and the body does not scroll behind the drawer.
3. Expand Veículos and follow Fichas Técnicas, Comparar Modelos and Comparar Especificações. Confirm the current public routes are used and the drawer closes, including when selecting the current URL.
4. Visitor/Public: no administrative links. Corporate: only Lista de Preços in the price group. Admin: no Agentes or Configurações. Master: management links remain available.
5. Visitor: Entrar / Criar conta opens the authentication drawer after navigation closes. Authenticated: Conta expands upward; profile/password/plan links remain usable and Sair still returns to the public Welcome.
6. Tab and Shift+Tab remain inside the open modal; Escape closes it and focus returns to the trigger. Touching the scrim closes it.
7. Rotate the device or resize to desktop while open. Confirm the modal closes, scroll is restored, and the original desktop sidebar works.
8. Enable reduced motion; confirm the same actions work without transition. Verify standalone PWA safe areas.
9. Scroll to the bottom of a long page and ensure the floating button does not cover the final action.

## Scope and known follow-ups

This covers the navigation pilot and the first responsive review of specification comparisons and price lists, not full mobile certification. Model cards, radar, auth and account page layouts still need their own responsive pass. Existing Corporate price-list route authorization is a prior Sprint 23C issue and is not changed by this navigation-only pilot. Never copy QA data to production; never rotate credentials as part of this sprint.


## Mobile review follow-up

- Specification comparison has the same 20px gutters as the radar page, with full-width mode and export groups below 1024px.
- Scroll vertically while the pointer/finger is inside the comparison body, then scroll horizontally; both directions must work independently. The document scrolls vertically on mobile and the comparison region scrolls horizontally.
- Both price lists show MMVY disclosure rows on mobile. Tap a row to reveal public price, validity, status, last update and (management only) existing actions. No hidden horizontal price columns. Desktop keeps its table.
- Sort any field through ascending, descending and default, including repeated fast taps. Numeric price order and natural vehicle order must match on mobile and desktop. Open-ended dates remain last. Management sorting must make zero new server requests; filtering and saving still use their existing server paths.
- Open and cancel a mobile price correction without saving; check that all fields and action buttons fit the card. Test actual saving/publication separately with disposable QA records.
- Price filters use full-width search and a separate status/clear row on mobile.

### Follow-up validation

- Local TypeScript and 16 focused permission/navigation/sort tests passed.
- Chromium fixtures at 320/390/768 px verified full-width controls and page-scroll chaining over comparison rows, including a touch swipe at 390 px. Horizontal overflow remained available where the table exceeded the viewport. Desktop 1440 px retained its navigation.
- Both price disclosures expanded correctly. Each three-state sort cycle restored its default order and issued zero RSC requests. Mobile correction fields opened and cancelled without persistence. No JavaScript errors were observed in this fixture run.
- Full lint/format/test commands were also executed and continue to report repository-wide warnings/legacy failures. Local production build could not fetch Inter from Google Fonts; the GitHub release gate remains the production-build check before QA completion.


## QA follow-up: navigation, scrolling and pricing UX (2026-10-25)

- Mobile navigation is portaled to `document.body` so page containers never define its fixed positioning. The logo trigger is hidden while open; the drawer has a separate close action. A one-pixel brand-blue border separates the graphite trigger from dark vehicle cards. Position remains 20px left and 24px bottom plus safe area.
- Account routes now share the sidebar. Choosing a destination closes expanded navigation groups; desktop also returns to the narrow sidebar. News and Chat follow the disabled Education style.
- Technical sheets and model comparison share 20px top spacing. Specification editing includes the standard return action to the model catalog.
- Comparison pages use natural document scrolling on every breakpoint. Only the model-name row gains a visual fixed copy at the viewport top after reaching it. The copy is hidden from assistive technology and synchronized horizontally; original table headers retain semantics. Pointer drag works with a mouse; touch and trackpad scrolling remain native.
- Text selection is disabled for displayed page data on desktop and mobile, with editable inputs/textareas exempt. This discourages casual copying; it is not data protection and cannot prevent screenshots, network extraction or browser overrides.
- Mobile price sort controls use equal 12px padding, a larger select and 44px arrow target aligned to the official disclosure icon. Existing Elementos assets (`arrow.svg`, `order2.svg`, `sort_back.svg`) are reused.
- Management filters expose Vigente, Previsto, Expirado, Arquivado and Todos. Legacy review workflow options are removed from the selector; stored historical statuses and database contracts are unchanged. Future and expired filtering uses all published pages and São Paulo operational dates, so future records cannot leak into Expirado. Read-only lists retain published visibility only.
- Loading brand versions reports an explicit empty or successful result. No versions is not a silent no-op. Price mutations are unchanged.
- Policy history only mounts its content when expanded, removing hidden-history scroll extent; the closed card has compact summary padding.

Follow-up validation: 26 focused tests passed; monorepo typecheck passed (9 packages); targeted lint had no errors (6 existing image warnings). Browser fixtures at 320/393/768/1440px confirmed no document horizontal overflow, mouse drag on mobile/desktop (150px/500px), vertical wheel/touch (600px/503px), header pinning at y=0 and synchronized horizontal position, 20px/24px fixed trigger margins after scrolling policies, hidden logo trigger while open, disabled News/Chat, empty Audi feedback, and exactly aligned sort/disclosure icon centers. Collapsed history had only its summary mounted and page ended 20px below its card in the fixture. No authenticated data was mutated. General suite: same 6 pre-existing core failures / 1098 passes; full lint has warnings with max-warnings=0; repository format check reports 193 files. Local build blocked fetching Inter from Google Fonts; QA release gate performs build in GitHub before publication. Temporary fixture/config changes were restored before checks and are excluded from the commit.
