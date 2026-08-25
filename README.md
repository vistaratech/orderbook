# Order Book

Digital version of the "Small Business Owner Order Book" — same fields as the
paper form (order #, customer, items, advance/balance, dispatch status),
built as an Expo / React Native app.

## Run it

```bash
npm install
npx expo start
```

Then:
- **Android** — press `a` (emulator) or scan the QR with Expo Go.
- **iOS** — press `i` (simulator) or scan the QR with the Camera app.
- **Web** — press `w`, or run `npx expo start --web` directly.

Runs on all three from the same codebase — no separate web project needed.
To ship a static web build: `npx expo export --platform web` (output lands
in `dist/`, ready to host anywhere — Vercel, Netlify, Cloudflare Pages, etc).

## What's in it

- **Order List** — every order as a card (customer, total, balance, status).
  Floating `+` button to start a new one.
- **New / Edit Order** — mirrors the paper form: order #, date, tracking #,
  customer name & phone, payment method/status, dispatch method/date, an
  item table (add/remove rows, auto Qty × Price), customer note, advance,
  and a live-computed balance.
- **Order Detail** — full readout of an order with a tap-to-update status
  stamp row (Placed → Packed → Dispatched → Delivered), call-customer
  shortcut, edit and delete.

Data is stored on-device with `AsyncStorage` (`src/storage/orderStorage.ts`)
— no backend yet. That file is the one place to swap in a real API/Supabase
later; every screen already calls through it instead of touching storage
directly, so the swap won't touch the UI.

## Structure

```
App.tsx                     navigation + font loading
src/types/order.ts           Order / OrderItem model, total & balance math
src/theme/theme.ts            colours, fonts, spacing — the paper/washi-tape look
src/storage/orderStorage.ts  AsyncStorage CRUD (swap point for a backend)
src/components/               StatusTracker, OrderCard, EmptyState
src/screens/                  OrderList, OrderForm, OrderDetail
```

## Design

Palette and type are pulled from the notebook cover: warm cream paper,
clay-pink and dusty-blue washi-tape accents, a handwritten display face
(Caveat) for headings paired with DM Sans for the actual order data. Dashed
input underlines and the status "stamp" row echo the printed form.

## Next steps worth considering

- Real auth + a backend (Supabase/Firebase) if this needs to sync across
  the owner's devices or become a real multi-tenant SaaS product.
- Search/filter on the order list once order volume grows.
- Export an order as a shareable receipt (image or PDF).
- App icon/splash image — `app.json` currently uses Expo's defaults.
