# Sprint 23D — mobile navigation pilot

Approved reference: [Figma A2, collapsed and expanded](https://www.figma.com/design/gFQSLkSSh3LZ0fHTWr06DT/compra-car?node-id=255-2).

## Behavior

- Below 1024 px: the existing desktop navigation content opens as a modal overlay from the left. No permanent icon rail and no content displacement.
- The official revised `mobile_icon_menu` is exported as `apps/web/public/carboot/mobile-menu.svg`. Its original 32 × 19 SVG dimensions are retained.
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

This is the navigation pilot, not full mobile certification. Tables, model cards, radar, auth and account page layouts receive their own responsive pass afterward. Existing Corporate price-list route authorization is a prior Sprint 23C issue and is not changed by this navigation-only pilot. Never copy QA data to production; never rotate credentials as part of this sprint.
