# Platform Clients + MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `@orderfood/ubereats-client`, `@orderfood/thuisbezorgd-client`, and `@orderfood/mcp-server` so Claude can search restaurants and place orders end-to-end.

**Architecture:** Each platform client wraps a session-cookie-authenticated REST API and maps platform-specific responses to `@orderfood/shared` types via a `mappers.ts` layer. The MCP server composes both clients behind the 11 tool schemas defined in the spec.

**Tech Stack:** TypeScript 5, pure ESM, `node-fetch`, `node-machine-id`, `@modelcontextprotocol/sdk`, Vitest

---

## API Facts — Uber Eats (from mitmproxy capture)

All calls are `POST https://www.ubereats.com/_p/api/{endpoint}?localeCode=nl-en` with session cookies (no Bearer token). Response envelope: `{ "status": "success", "data": {...} }`.

**Address resolution flow:**
1. `mapsSearchV1 { "query": "..." }` → `data[].{ id, provider, addressLine1, addressLine2 }`
2. `upsertDeliveryLocationV2 { addressInfo: {...}, referenceInfo: { placeID: id, provider } }` → `data.deliveryLocation.location.{ coordinate.{ latitude, longitude }, id, fullAddress }`

**cacheKey format** (used in `getFeedV1`):
```
base64(encodeURIComponent(JSON.stringify({ address, reference: id, referenceType: provider, latitude, longitude })))
```

**Restaurant search:** `getFeedV1 { "cacheKey": <above>, "userQuery": "", "sortAndFilters": [] }` → `data.feedItems` (UI tiles) + `data.storesMap` (store details by UUID)

**Restaurant + menu:** `getStoreV1 { "storeUuid": "...", "diningMode": "DELIVERY" }` → `data` contains `sections[]`, `subsectionsMap`, `catalogSectionsMap` (VERTICAL_GRID/HORIZONTAL_GRID entries with `payload.standardItemsPayload.catalogItems[]`)

**Item details:** `getMenuItemV1 { "itemRequestType": "ITEM", "storeUuid", "sectionUuid", "subsectionUuid", "itemUuid" }` → full item with `optionGroups[]`

**Create cart:** `createDraftOrderV2 { "isMulticart": false, "shoppingCartItems": [{ uuid, shoppingCartItemUuid, storeUuid, sectionUuid, subsectionUuid, price, title, quantity, customizations: { "{groupUuid}+0": [{ uuid, price, quantity, title, defaultQuantity, customizationMeta }], "{groupUuid}+0,{optionUuid},{subGroupUuid}+0": [...] } }] }` → `data.draftOrder.{ uuid, shoppingCart }`

**Get cart:** `getDraftOrderByUuidV2 { "draftOrderUUID": "..." }` → `data.draftOrder`

**List draft orders:** `getDraftOrdersByEaterUuidV1 {}` → `data.draftOrders[]`

**Update cart (set address + payment):** `updateDraftOrderV2 { "paymentProfileUUID", "useCredits": true, "deliveryType": "ASAP", "extraPaymentProfiles": [], "interactionType": "door_to_door", "deliveryAddress": { latitude, longitude, address: { address1, title, subtitle }, reference, referenceType: "google_places", type: "google_places" }, "targetDeliveryTimeRange": { "asap": true }, "diningMode": "DELIVERY", "draftOrderUUID", "paymentProfileSelectionSource": "USER" }` → `data.draftOrder`

**Place order:** `submitDraftOrderV2 { "draftOrderUUID" }` → **endpoint NOT captured, requires a second capture session where the user presses "Place Order".** Implement as a stub initially.

**Active orders:** `getActiveOrdersV1 { "orderUuid": null, "timezone": "Europe/Amsterdam", "showAppUpsellIllustration": true }` → `data.orders[]`

**Order history:** `getOrderEntitiesV1 {}` → `data` (was null in capture — likely needs specific params; implement stub)

**Payment profiles:** `GET https://payments.ubereats.com/_api/payment-profiles?ctx=<encoded>&flow=FLOW_SELECT&key=production_u2bkf0z5pn0e552g` → `availablePaymentProfiles[]`
Also: `getProfilesForUserV1 {}` → `data.profiles[]` (user profile with `defaultPaymentProfileUuid`)

**Auth cookies needed:** `jwt-session`, `uev2.id.session`, `uev2.id.session_v2`, `uev2.ts.session`, `uev2.ts.session_v2`, `_ua`, `dId`, `uev2.id.xp`

---

## File Structure

```
packages/
  ubereats-client/
    package.json
    tsconfig.json
    src/
      auth.ts          — load/save encrypted session cookies; check expiry; refresh stub
      types.ts         — UE-specific API response shapes (raw JSON → TS interfaces)
      mappers.ts       — UE types → @orderfood/shared types
      client.ts        — UberEatsClient implements PlatformClient
    tests/
      mappers.test.ts  — unit tests for mapper functions (no network)
      client.test.ts   — integration tests (skipped by default, require real credentials)

  thuisbezorgd-client/
    package.json
    tsconfig.json
    src/
      auth.ts
      types.ts
      mappers.ts
      client.ts
    tests/
      mappers.test.ts

  mcp-server/
    package.json
    tsconfig.json
    src/
      config.ts        — load credentials, instantiate platform clients
      index.ts         — McpServer entry point, registers all tools
      setup.ts         — CLI: `npx orderfood setup --platform ubereats`
      tools/
        discovery.ts   — search_restaurants, get_restaurant
        cart.ts        — get_cart, add_to_cart, clear_cart
        orders.ts      — place_order, track_order, get_order_history, cancel_order
        account.ts     — get_saved_addresses, get_payment_methods
```

---

## Task 1: Package scaffolding

**Files:**
- Create: `packages/ubereats-client/package.json`
- Create: `packages/ubereats-client/tsconfig.json`
- Create: `packages/thuisbezorgd-client/package.json`
- Create: `packages/thuisbezorgd-client/tsconfig.json`
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Modify: root `package.json` (no change needed — workspace glob already covers it)

- [ ] **Step 1: Create `packages/ubereats-client/package.json`**

```json
{
  "name": "@orderfood/ubereats-client",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/client.js",
  "types": "./dist/client.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@orderfood/shared": "workspace:*",
    "node-fetch": "^3.3.2",
    "node-machine-id": "^1.1.12"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/ubereats-client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/thuisbezorgd-client/package.json`** (same structure, different name)

```json
{
  "name": "@orderfood/thuisbezorgd-client",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/client.js",
  "types": "./dist/client.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@orderfood/shared": "workspace:*",
    "node-fetch": "^3.3.2",
    "node-machine-id": "^1.1.12"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4: Create `packages/thuisbezorgd-client/tsconfig.json`** (identical to ubereats-client)

- [ ] **Step 5: Create `packages/mcp-server/package.json`**

```json
{
  "name": "@orderfood/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "orderfood": "./dist/setup.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.9.0",
    "@orderfood/shared": "workspace:*",
    "@orderfood/ubereats-client": "workspace:*",
    "@orderfood/thuisbezorgd-client": "workspace:*",
    "node-machine-id": "^1.1.12",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 6: Create `packages/mcp-server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 7: Install dependencies**

```bash
cd /path/to/OrderFood && pnpm install --force
```

Expected: packages installed, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/ubereats-client/package.json packages/ubereats-client/tsconfig.json \
        packages/thuisbezorgd-client/package.json packages/thuisbezorgd-client/tsconfig.json \
        packages/mcp-server/package.json packages/mcp-server/tsconfig.json
git commit -m "chore: scaffold ubereats-client, thuisbezorgd-client, mcp-server packages"
```

---

## Task 2: Auth module (shared credential pattern)

Both platform clients use the same AES-256-GCM + HKDF-SHA256 pattern defined in the spec. Implement it once in `ubereats-client/src/auth.ts` — thuisbezorgd will be identical with different constants.

**Files:**
- Create: `packages/ubereats-client/src/auth.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ubereats-client/tests/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { encryptCredentials, decryptCredentials } from '../src/auth.js';

describe('credential encryption', () => {
  it('round-trips access_token through encrypt/decrypt', async () => {
    const creds = {
      access_token: 'test-token-abc',
      refresh_token: 'refresh-xyz',
      expires_at: '2030-01-01T00:00:00.000Z',
      cookies: { 'jwt-session': 'fake-jwt' },
    };
    const encrypted = await encryptCredentials(creds);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    const decrypted = await decryptCredentials(encrypted);
    expect(decrypted.access_token).toBe('test-token-abc');
    expect(decrypted.cookies['jwt-session']).toBe('fake-jwt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/ubereats-client exec vitest run tests/auth.test.ts
```

Expected: FAIL with "Cannot find module '../src/auth.js'"

- [ ] **Step 3: Implement `packages/ubereats-client/src/auth.ts`**

```typescript
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { machineIdSync } from 'node-machine-id';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface UberEatsCredentials {
  access_token: string;   // unused for cookie-based auth, kept for interface compat
  refresh_token: string;
  expires_at: string;     // ISO 8601
  cookies: Record<string, string>;
}

interface StoredCredentials {
  iv: string;
  ciphertext: string;
  user_id: string;
}

const PLATFORM = 'ubereats';
const SALT = 'orderfood-v1';

function deriveKey(): Buffer {
  const machineId = machineIdSync(true); // raw hex
  // HKDF-SHA256: extract step (HMAC-SHA256(salt, IKM))
  const prk = createHash('sha256')
    .update(Buffer.from(SALT))
    .update(Buffer.from(machineId, 'hex'))
    .digest();
  // expand step (HMAC-SHA256(prk, info || 0x01))
  const info = Buffer.from(PLATFORM);
  const okm = createHash('sha256')
    .update(prk)
    .update(info)
    .update(Buffer.from([0x01]))
    .digest();
  return okm.slice(0, 32);
}

export async function encryptCredentials(creds: UberEatsCredentials): Promise<StoredCredentials> {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(creds));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    user_id: '',
  };
}

export async function decryptCredentials(stored: StoredCredentials): Promise<UberEatsCredentials> {
  const key = deriveKey();
  const iv = Buffer.from(stored.iv, 'base64');
  const buf = Buffer.from(stored.ciphertext, 'base64');
  const tag = buf.slice(buf.length - 16);
  const ciphertext = buf.slice(0, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString()) as UberEatsCredentials;
}

function credentialsPath(): string {
  return join(homedir(), '.orderfood', `${PLATFORM}.json`);
}

export async function loadCredentials(): Promise<UberEatsCredentials> {
  const stored: StoredCredentials = JSON.parse(await readFile(credentialsPath(), 'utf-8'));
  return decryptCredentials(stored);
}

export async function saveCredentials(creds: UberEatsCredentials): Promise<void> {
  const path = credentialsPath();
  await mkdir(join(homedir(), '.orderfood'), { recursive: true });
  const stored = await encryptCredentials(creds);
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf-8');
}

export function isCookiesExpired(creds: UberEatsCredentials): boolean {
  // UberEats session cookies don't have a predictable expiry — check expires_at
  return new Date(creds.expires_at) <= new Date(Date.now() + 60_000);
}
```

Note: This uses a simplified HKDF implementation. The derive is: HMAC-SHA256(salt, IKM) as PRK, then HMAC-SHA256(PRK, info || 0x01) as OKM. For production, use Node.js `crypto.hkdf()` (Node 15+) — but this avoids the async complexity in tests.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/ubereats-client exec vitest run tests/auth.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ubereats-client/src/auth.ts packages/ubereats-client/tests/auth.test.ts
git commit -m "feat(ubereats-client): add AES-256-GCM credential encryption"
```

---

## Task 3: Uber Eats API types

**Files:**
- Create: `packages/ubereats-client/src/types.ts`

- [ ] **Step 1: Create `packages/ubereats-client/src/types.ts`**

No tests needed — these are pure TypeScript interfaces, no logic to test.

```typescript
// Raw Uber Eats API response shapes

export interface UEApiResponse<T> {
  status: 'success' | 'failure';
  data: T;
}

// mapsSearchV1
export interface UEAddressSuggestion {
  id: string;
  provider: string;
  addressLine1: string;
  addressLine2: string;
  categories: string[];
}

// upsertDeliveryLocationV2
export interface UEDeliveryLocation {
  deliveryLocation: {
    location: {
      name: string;
      addressLine1: string;
      addressLine2: string;
      fullAddress: string;
      coordinate: { latitude: number; longitude: number };
      id: string;
    };
  };
}

// getFeedV1
export interface UEFeedItem {
  uuid: string;
  type: string;
  text?: string;
  actionUrl?: string;
}

export interface UEStoreCard {
  uuid: string;
  title: { text: string };
  rating?: { text: string; accessibilityText: string };
  etaRange?: { text: string };
  fareInfo?: { displayString: string };
  heroImageUrl?: string;
  cuisineList?: { cuisines: { uuid: string; name: string }[] };
}

export interface UEFeedResponse {
  feedItems: UEFeedItem[];
  storesMap: Record<string, UEStoreCard>;
}

// getStoreV1
export interface UECatalogItem {
  uuid: string;
  imageUrl?: string;
  title: string;
  itemDescription?: string;
  price: number;
  isSoldOut?: boolean;
  hasCustomizations?: boolean;
  sectionUuid?: string;
  subsectionUuid?: string;
}

export interface UECatalogGrid {
  type: 'VERTICAL_GRID' | 'HORIZONTAL_GRID';
  catalogSectionUUID: string;
  payload: {
    standardItemsPayload: {
      title?: { text: string };
      catalogItems: UECatalogItem[];
      sectionUUID: string;
    };
  };
}

export interface UESection {
  uuid: string;
  title: string;
  subtitle?: string;
  subsectionUuids: string[];
}

export interface UEStoreResponse {
  uuid: string;
  title: string;
  rating?: { text: string };
  etaRange?: { text: string };
  fareInfo?: { displayString: string };
  cuisineList?: { cuisines: { uuid: string; name: string }[] };
  heroImageUrls?: { url: string }[];
  sections: UESection[];
  catalogSectionsMap: Record<string, (UECatalogGrid | { type: string })[]>;
}

// getMenuItemV1
export interface UEMenuOption {
  uuid: string;
  title: string;
  price: number;
  defaultQuantity?: number;
}

export interface UEOptionGroup {
  uuid: string;
  title: string;
  minPermitted: number;
  maxPermitted: number;
  options: UEMenuOption[];
}

export interface UEMenuItemResponse {
  uuid: string;
  title: string;
  itemDescription?: string;
  price: number;
  imageUrl?: string;
  sectionUuid?: string;
  subsectionUuid?: string;
  customizationGroups?: UEOptionGroup[];
}

// Draft order / cart
export interface UEShoppingCartItem {
  uuid: string;
  shoppingCartItemUuid: string;
  storeUuid: string;
  sectionUuid: string;
  subsectionUuid: string;
  price: number;
  title: string;
  quantity: number;
  customizations: Record<string, UECustomizationEntry[]>;
}

export interface UECustomizationEntry {
  uuid: string;
  price: number;
  quantity: number;
  title: string;
  defaultQuantity?: number;
  customizationMeta?: { title: string; isPickOne?: boolean };
}

export interface UEDraftOrder {
  uuid: string;
  storeUuid: string;
  shoppingCart: {
    cartUuid: string;
    storeUuid: string;
    items: (UEShoppingCartItem & { consumerUuid: string; specialInstructions: string })[];
  };
}

// Payment profiles
export interface UEPaymentProfile {
  uuid: string;
  accountName: string;
  status: string;
  tokenType: string;
  tokenDisplayName?: string;
  hasBalance?: boolean;
}

// Active orders
export interface UEActiveOrder {
  uuid: string;
  storeInfo?: { title?: string };
  status?: string;
  scheduledAt?: string;
  estimatedDeliveryTime?: string;
  total?: { price?: { amount: number } };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ubereats-client/src/types.ts
git commit -m "feat(ubereats-client): add API response type definitions"
```

---

## Task 4: Uber Eats mappers

**Files:**
- Create: `packages/ubereats-client/src/mappers.ts`
- Create: `packages/ubereats-client/tests/mappers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/ubereats-client/tests/mappers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapStore, mapRestaurantWithMenu, mapCart, mapActiveOrder } from '../src/mappers.js';
import type { UEStoreCard, UEStoreResponse, UEDraftOrder, UEActiveOrder } from '../src/types.js';

const mockStoreCard: UEStoreCard = {
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  title: { text: 'Pizza Place' },
  rating: { text: '4.8', accessibilityText: '4.8 stars' },
  etaRange: { text: '25-35 min' },
  fareInfo: { displayString: '€0.99 delivery' },
  cuisineList: { cuisines: [{ uuid: '1', name: 'Italian' }] },
};

const mockStoreResponse: UEStoreResponse = {
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Pizza Place',
  rating: { text: '4.8' },
  etaRange: { text: '25-35 min' },
  fareInfo: { displayString: '€0.99 delivery' },
  cuisineList: { cuisines: [{ uuid: '1', name: 'Italian' }] },
  heroImageUrls: [{ url: 'https://example.com/pizza.jpg' }],
  sections: [{ uuid: 'sec-1', title: 'Pizzas', subsectionUuids: ['sub-1'] }],
  catalogSectionsMap: {
    'sec-1': [{
      type: 'VERTICAL_GRID',
      catalogSectionUUID: 'sec-1',
      payload: {
        standardItemsPayload: {
          title: { text: 'Pizzas' },
          catalogItems: [{
            uuid: 'item-1',
            title: 'Margherita',
            itemDescription: 'Classic tomato and mozzarella',
            price: 1299,
            isSoldOut: false,
            hasCustomizations: false,
            sectionUuid: 'sec-1',
            subsectionUuid: 'sub-1',
          }],
          sectionUUID: 'sec-1',
        },
      },
    }],
  },
};

describe('mapStore', () => {
  it('maps a feed store card to Restaurant', () => {
    const r = mapStore(mockStoreCard);
    expect(r.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(r.platform).toBe('ubereats');
    expect(r.name).toBe('Pizza Place');
    expect(r.rating).toBe(4.8);
    expect(r.cuisine).toEqual(['Italian']);
    expect(r.delivery_time_min).toBe(25);
  });
});

describe('mapRestaurantWithMenu', () => {
  it('maps a store response to RestaurantWithMenu with categories', () => {
    const r = mapRestaurantWithMenu(mockStoreResponse);
    expect(r.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(r.categories).toHaveLength(1);
    expect(r.categories[0].name).toBe('Pizzas');
    expect(r.categories[0].items).toHaveLength(1);
    expect(r.categories[0].items[0].id).toBe('item-1');
    expect(r.categories[0].items[0].price).toBe(1299);
    expect(r.categories[0].items[0].option_groups).toEqual([]);
  });
});

describe('mapActiveOrder', () => {
  it('maps an active order to Order', () => {
    const ueOrder: UEActiveOrder = {
      uuid: 'order-uuid-123',
      storeInfo: { title: 'Pizza Place' },
      status: 'PREPARING',
      scheduledAt: '2026-03-22T19:00:00.000Z',
    };
    const o = mapActiveOrder(ueOrder);
    expect(o.id).toBe('order-uuid-123');
    expect(o.status).toBe('preparing');
    expect(o.restaurant_name).toBe('Pizza Place');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/ubereats-client exec vitest run tests/mappers.test.ts
```

Expected: FAIL with "Cannot find module '../src/mappers.js'"

- [ ] **Step 3: Implement `packages/ubereats-client/src/mappers.ts`**

```typescript
import type {
  Restaurant, RestaurantWithMenu, MenuCategory, MenuItem,
  Cart, CartItem, CartItemOption, Order, OrderStatus, PaymentMethod,
} from '@orderfood/shared';
import type {
  UEStoreCard, UEStoreResponse, UECatalogGrid, UEDraftOrder,
  UEActiveOrder, UEPaymentProfile, UEMenuItemResponse,
} from './types.js';

export function mapStore(s: UEStoreCard): Restaurant {
  const etaMin = parseEtaMin(s.etaRange?.text);
  const deliveryFee = parseDeliveryFee(s.fareInfo?.displayString);
  return {
    id: s.uuid,
    platform: 'ubereats',
    name: s.title.text,
    cuisine: s.cuisineList?.cuisines.map(c => c.name) ?? [],
    rating: parseFloat(s.rating?.text ?? '0') || 0,
    delivery_time_min: etaMin,
    delivery_fee: deliveryFee,
    min_order: 0,
    image_url: undefined,
  };
}

export function mapRestaurantWithMenu(s: UEStoreResponse): RestaurantWithMenu {
  const categories: MenuCategory[] = [];

  for (const [sectionUuid, entries] of Object.entries(s.catalogSectionsMap)) {
    const sectionMeta = s.sections.find(sec => sec.uuid === sectionUuid);
    const sectionName = sectionMeta?.title ?? sectionUuid;

    const items: MenuItem[] = [];
    for (const entry of entries) {
      const grid = entry as UECatalogGrid;
      if (!grid.payload?.standardItemsPayload?.catalogItems) continue;
      for (const ci of grid.payload.standardItemsPayload.catalogItems) {
        items.push({
          id: ci.uuid,
          name: ci.title,
          description: ci.itemDescription,
          price: ci.price,
          category: sectionName,
          option_groups: [],   // populated lazily via getMenuItemV1
          image_url: ci.imageUrl,
        });
      }
    }
    if (items.length > 0) {
      categories.push({ name: sectionName, items });
    }
  }

  const etaMin = parseEtaMin(s.etaRange?.text);
  const deliveryFee = parseDeliveryFee(s.fareInfo?.displayString);
  return {
    id: s.uuid,
    platform: 'ubereats',
    name: s.title,
    cuisine: s.cuisineList?.cuisines.map(c => c.name) ?? [],
    rating: parseFloat(s.rating?.text ?? '0') || 0,
    delivery_time_min: etaMin,
    delivery_fee: deliveryFee,
    min_order: 0,
    image_url: s.heroImageUrls?.[0]?.url,
    categories,
  };
}

export function mapMenuItem(item: UEMenuItemResponse): MenuItem {
  return {
    id: item.uuid,
    name: item.title,
    description: item.itemDescription,
    price: item.price,
    category: '',
    image_url: item.imageUrl,
    option_groups: (item.customizationGroups ?? []).map(g => ({
      id: g.uuid,
      name: g.title,
      required: g.minPermitted > 0,
      min_selections: g.minPermitted,
      max_selections: g.maxPermitted,
      options: g.options.map(o => ({
        id: o.uuid,
        name: o.title,
        price_delta: o.price,
      })),
    })),
  };
}

export function mapCart(draftOrder: UEDraftOrder): Cart {
  const items: CartItem[] = draftOrder.shoppingCart.items.map(i => ({
    item_id: i.uuid,
    name: i.title,
    quantity: i.quantity,
    unit_price: i.price,
    selected_options: flattenCustomizations(i.customizations),
  }));
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  return {
    restaurant_id: draftOrder.storeUuid,
    platform: 'ubereats',
    items,
    subtotal,
    delivery_fee: 0,   // not available without getCheckoutPresentationV1
    total: subtotal,
  };
}

export function mapActiveOrder(o: UEActiveOrder): Order {
  return {
    id: o.uuid,
    platform: 'ubereats',
    status: mapOrderStatus(o.status),
    restaurant_name: o.storeInfo?.title ?? 'Unknown',
    items: [],
    total: o.total?.price?.amount ?? 0,
    placed_at: o.scheduledAt ?? new Date().toISOString(),
    estimated_delivery: o.estimatedDeliveryTime,
  };
}

export function mapPaymentProfile(p: UEPaymentProfile): PaymentMethod {
  return {
    id: p.uuid,
    type: guessPaymentType(p.tokenDisplayName ?? p.accountName),
    label: p.tokenDisplayName ?? p.accountName,
    is_default: false,   // caller sets is_default based on profile defaultPaymentProfileUuid
  };
}

// --- helpers ---

function parseEtaMin(text?: string): number {
  if (!text) return 0;
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDeliveryFee(text?: string): number {
  if (!text) return 0;
  const m = text.match(/[\d,.]+/);
  if (!m) return 0;
  return Math.round(parseFloat(m[0].replace(',', '.')) * 100);
}

function mapOrderStatus(s?: string): OrderStatus {
  switch (s?.toUpperCase()) {
    case 'PENDING': return 'pending';
    case 'ACCEPTED': case 'CONFIRMED': return 'confirmed';
    case 'STARTED': case 'PREPARING': case 'IN_PROGRESS': return 'preparing';
    case 'PICKED_UP': case 'DRIVER_EN_ROUTE': return 'picked_up';
    case 'COMPLETED': case 'DELIVERED': return 'delivered';
    case 'CANCELLED': case 'CANCELED': return 'cancelled';
    default: return 'pending';
  }
}

function guessPaymentType(name: string): PaymentMethod['type'] {
  const n = name.toLowerCase();
  if (n.includes('ideal')) return 'ideal';
  if (n.includes('paypal')) return 'paypal';
  if (n.includes('cash')) return 'cash';
  if (n.match(/visa|mastercard|amex|card/)) return 'card';
  return 'other';
}

function flattenCustomizations(
  customizations: Record<string, { uuid: string }[]>,
): CartItemOption[] {
  const options: CartItemOption[] = [];
  for (const [key, entries] of Object.entries(customizations)) {
    // key format: "{groupUuid}+{index}" or "{groupUuid}+{index},{optionUuid},{subGroupUuid}+{index}"
    // Extract the groupUuid from the first segment before "+"
    const groupUuid = key.split('+')[0];
    for (const entry of entries) {
      options.push({ group_id: groupUuid, option_id: entry.uuid });
    }
  }
  return options;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/ubereats-client exec vitest run tests/mappers.test.ts
```

Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/ubereats-client/src/mappers.ts packages/ubereats-client/tests/mappers.test.ts
git commit -m "feat(ubereats-client): add API response mappers"
```

---

## Task 5: Uber Eats client

**Files:**
- Create: `packages/ubereats-client/src/client.ts`

The client wraps all API calls. Cart management uses a local UUID cache for `draftOrderUUID` (stored in memory during the session; on restart, recovered via `getDraftOrdersByEaterUuidV1`).

- [ ] **Step 1: Implement `packages/ubereats-client/src/client.ts`**

```typescript
import fetch from 'node-fetch';
import { randomUUID } from 'node:crypto';
import type {
  PlatformClient, SearchParams, Restaurant, RestaurantWithMenu,
  Cart, CartItemOption, Order, OrderStatus, Address, PaymentMethod,
} from '@orderfood/shared';
import { AuthError, NotFoundError, PlatformError, RateLimitError } from '@orderfood/shared';
import { loadCredentials, type UberEatsCredentials } from './auth.js';
import type {
  UEApiResponse, UEAddressSuggestion, UEDeliveryLocation,
  UEFeedResponse, UEStoreResponse, UEMenuItemResponse,
  UEDraftOrder, UEActiveOrder, UEPaymentProfile,
} from './types.js';
import {
  mapStore, mapRestaurantWithMenu, mapMenuItem, mapCart,
  mapActiveOrder, mapPaymentProfile,
} from './mappers.js';

const BASE = 'https://www.ubereats.com/_p/api';
const LOCALE = 'nl-en';

export class UberEatsClient implements PlatformClient {
  private credentials: UberEatsCredentials | null = null;
  private draftOrderUUID: string | null = null;

  private async getCreds(): Promise<UberEatsCredentials> {
    if (!this.credentials) {
      try {
        this.credentials = await loadCredentials();
      } catch {
        throw new AuthError(
          'Uber Eats credentials not found. Run: npx orderfood setup --platform ubereats',
          'AUTH_MISSING',
        );
      }
    }
    return this.credentials;
  }

  private async cookieHeader(): Promise<string> {
    const creds = await this.getCreds();
    return Object.entries(creds.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const cookie = await this.cookieHeader();
    const res = await fetch(`${BASE}/${endpoint}?localeCode=${LOCALE}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'x',
        cookie,
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1',
        referer: 'https://www.ubereats.com/nl-en',
        'accept-language': 'en-US,en;q=0.9',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      throw new RateLimitError('Uber Eats rate limit exceeded', retryAfter);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('Session expired. Re-run: npx orderfood setup --platform ubereats', 'AUTH_EXPIRED');
    }
    if (!res.ok) {
      throw new PlatformError(`Uber Eats API error: ${res.status}`, 'API_ERROR', res.status);
    }

    const json = (await res.json()) as UEApiResponse<T>;
    if (json.status !== 'success') {
      throw new PlatformError('Uber Eats returned non-success status', 'API_FAILURE');
    }
    return json.data;
  }

  private async resolveLocation(location: string): Promise<{ lat: number; lng: number; reference: string; address: string }> {
    const suggestions = await this.post<UEAddressSuggestion[]>('mapsSearchV1', { query: location });
    if (!suggestions || suggestions.length === 0) {
      throw new NotFoundError(`No location found for: ${location}`, 'LOCATION_NOT_FOUND');
    }
    const suggestion = suggestions[0];
    const upsert = await this.post<UEDeliveryLocation>('upsertDeliveryLocationV2', {
      addressInfo: {
        HOUSE_NUMBER: '',
        STREET_ADDRESS: suggestion.addressLine1,
        BUSINESS_NAME: '',
      },
      selectedInteractionType: 'door_to_door',
      deliveryPayloadType: 'USER_INPUT',
      isTargetLocation: true,
      referenceInfo: { placeID: suggestion.id, provider: suggestion.provider },
      label: '',
      deliveryInstruction: { pinDropInfo: null },
    });
    const loc = upsert.deliveryLocation.location;
    return {
      lat: loc.coordinate.latitude,
      lng: loc.coordinate.longitude,
      reference: suggestion.id,
      address: suggestion.addressLine1,
    };
  }

  private buildCacheKey(addr: { address: string; reference: string; lat: number; lng: number }): string {
    const obj = {
      address: addr.address,
      reference: addr.reference,
      referenceType: 'google_places',
      latitude: addr.lat,
      longitude: addr.lng,
    };
    return Buffer.from(encodeURIComponent(JSON.stringify(obj))).toString('base64');
  }

  async searchRestaurants(params: SearchParams): Promise<Restaurant[]> {
    const addr = await this.resolveLocation(params.location);
    const cacheKey = this.buildCacheKey({ address: addr.address, reference: addr.reference, lat: addr.lat, lng: addr.lng });

    const feed = await this.post<UEFeedResponse>('getFeedV1', {
      cacheKey,
      feedSessionCount: { announcementCount: 0, announcementLabel: '' },
      userQuery: params.query ?? '',
      date: '',
      startTime: 0,
      endTime: 0,
      sortAndFilters: [],
      isUserInitiatedRefresh: false,
      billboardUuid: '',
      feedProvider: '',
      promotionUuid: '',
      targetingStoreTag: '',
      venueUUID: '',
      selectedSectionUUID: '',
      favorites: '',
      vertical: '',
      searchSource: '',
      searchType: '',
      keyName: '',
      serializedRequestContext: '',
      carouselId: '',
    });

    const stores = Object.values(feed.storesMap).map(s => mapStore(s));

    if (params.cuisine) {
      const q = params.cuisine.toLowerCase();
      return stores.filter(s => s.cuisine.some(c => c.toLowerCase().includes(q)));
    }
    return stores;
  }

  async getRestaurant(restaurantId: string): Promise<RestaurantWithMenu> {
    const data = await this.post<UEStoreResponse>('getStoreV1', {
      storeUuid: restaurantId,
      diningMode: 'DELIVERY',
    });
    return mapRestaurantWithMenu(data);
  }

  async getCart(): Promise<Cart | null> {
    if (!this.draftOrderUUID) {
      // Try to recover from server
      const data = await this.post<{ draftOrders: UEDraftOrder[] }>('getDraftOrdersByEaterUuidV1', {});
      if (!data.draftOrders || data.draftOrders.length === 0) return null;
      this.draftOrderUUID = data.draftOrders[0].uuid;
    }
    const data = await this.post<{ draftOrder: UEDraftOrder }>('getDraftOrderByUuidV2', {
      draftOrderUUID: this.draftOrderUUID,
    });
    if (!data.draftOrder) return null;
    return mapCart(data.draftOrder);
  }

  async addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[],
  ): Promise<Cart> {
    // Get item details to fill sectionUuid, subsectionUuid, price, title
    const restaurant = await this.getRestaurant(restaurantId);
    let itemMeta: { sectionUuid: string; subsectionUuid: string; price: number; title: string } | null = null;
    for (const cat of restaurant.categories) {
      const item = cat.items.find(i => i.id === itemId);
      if (item) {
        // Retrieve from raw data — we store sectionUuid in the category name (limitation of current mapper)
        // For now use empty strings; this needs enhancement if sections are required
        itemMeta = { sectionUuid: '', subsectionUuid: '', price: item.price, title: item.name };
        break;
      }
    }
    if (!itemMeta) throw new NotFoundError(`Item ${itemId} not found in restaurant ${restaurantId}`, 'ITEM_NOT_FOUND');

    // Build existing items list
    const existingCart = await this.getCart();
    const existingItems = existingCart
      ? existingCart.items.map(ci => ({
          uuid: ci.item_id,
          shoppingCartItemUuid: randomUUID(),
          storeUuid: restaurantId,
          sectionUuid: '',
          subsectionUuid: '',
          price: ci.unit_price,
          title: ci.name,
          quantity: ci.quantity,
          customizations: {},
        }))
      : [];

    const newItem = {
      uuid: itemId,
      shoppingCartItemUuid: randomUUID(),
      storeUuid: restaurantId,
      sectionUuid: itemMeta.sectionUuid,
      subsectionUuid: itemMeta.subsectionUuid,
      price: itemMeta.price,
      title: itemMeta.title,
      quantity,
      customizations: buildCustomizations(options ?? []),
    };

    const data = await this.post<{ draftOrder: UEDraftOrder }>('createDraftOrderV2', {
      isMulticart: false,
      shoppingCartItems: [...existingItems, newItem],
    });
    this.draftOrderUUID = data.draftOrder.uuid;
    return mapCart(data.draftOrder);
  }

  async clearCart(): Promise<void> {
    if (!this.draftOrderUUID) return;
    // Create draft order with empty items list effectively replaces the cart
    await this.post<{ draftOrder: UEDraftOrder }>('createDraftOrderV2', {
      isMulticart: false,
      shoppingCartItems: [],
    });
    this.draftOrderUUID = null;
  }

  async getSavedAddresses(): Promise<Address[]> {
    // UE doesn't have a standalone saved-addresses endpoint in captured traffic.
    // Return empty list — users pass a location string to search_restaurants instead.
    return [];
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await this.post<{ profiles: { uuid: string; defaultPaymentProfileUuid: string }[] }>(
      'getProfilesForUserV1', {}
    );
    const defaultProfileUuid = data.profiles?.[0]?.defaultPaymentProfileUuid ?? '';

    const paymentsRes = await fetch(
      `https://payments.ubereats.com/_api/payment-profiles?flow=FLOW_SELECT&key=production_u2bkf0z5pn0e552g`,
      {
        headers: {
          cookie: await this.cookieHeader(),
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1',
        },
      }
    );
    if (!paymentsRes.ok) throw new PlatformError('Failed to fetch payment methods', 'PAYMENT_ERROR');
    const paymentsData = (await paymentsRes.json()) as { availablePaymentProfiles: UEPaymentProfile[] };

    return (paymentsData.availablePaymentProfiles ?? []).map(p => ({
      ...mapPaymentProfile(p),
      is_default: p.uuid === defaultProfileUuid,
    }));
  }

  async placeOrder(addressId: string, paymentMethodId: string): Promise<Order> {
    if (!this.draftOrderUUID) throw new PlatformError('Cart is empty', 'CART_EMPTY');

    // First update the draft order with delivery address + payment
    // addressId here is a location string (from getSavedAddresses or user input)
    // For now, addressId doubles as a free-form address string
    const addr = await this.resolveLocation(addressId);
    await this.post<unknown>('updateDraftOrderV2', {
      paymentProfileUUID: paymentMethodId,
      useCredits: true,
      deliveryType: 'ASAP',
      extraPaymentProfiles: [],
      interactionType: 'door_to_door',
      cartLockOptions: null,
      deliveryAddress: {
        latitude: addr.lat,
        longitude: addr.lng,
        address: { address1: addr.address, address2: '', aptOrSuite: '', eaterFormattedAddress: '', title: addr.address, subtitle: '' },
        reference: addr.reference,
        referenceType: 'google_places',
        type: 'google_places',
        addressComponents: { countryCode: '', firstLevelSubdivisionCode: '', city: '', postalCode: '' },
      },
      targetDeliveryTimeRange: { asap: true },
      diningMode: 'DELIVERY',
      draftOrderUUID: this.draftOrderUUID,
      paymentProfileSelectionSource: 'USER',
    });

    // TODO: submitDraftOrderV2 endpoint was NOT captured — needs a second capture session
    // where the user presses "Place Order". Current implementation throws with a clear message.
    throw new PlatformError(
      'place_order not yet implemented: submitDraftOrderV2 endpoint needs a second capture session. ' +
      'Browse to checkout in the Uber Eats web app while mitmproxy is running and press "Place Order".',
      'NOT_IMPLEMENTED',
    );
  }

  async trackOrder(orderId: string): Promise<{ status: OrderStatus; details: string }> {
    const data = await this.post<{ orders: UEActiveOrder[] }>('getActiveOrdersV1', {
      orderUuid: orderId,
      timezone: 'Europe/Amsterdam',
      showAppUpsellIllustration: true,
    });
    const order = data.orders?.find(o => o.uuid === orderId) ?? data.orders?.[0];
    if (!order) throw new NotFoundError(`Order ${orderId} not found`, 'ORDER_NOT_FOUND');
    const mapped = mapActiveOrder(order);
    return { status: mapped.status, details: `Order is ${mapped.status}` };
  }

  async getOrderHistory(limit = 10): Promise<Order[]> {
    // getOrderEntitiesV1 returned null in capture — endpoint needs specific params
    // Stub implementation returns empty list with a TODO comment
    // TODO: capture order history flow in Uber Eats web app to discover correct request body
    return [];
  }

  async cancelOrder(orderId: string): Promise<void> {
    // TODO: cancelOrder endpoint not captured
    throw new PlatformError('cancel_order not yet implemented', 'NOT_IMPLEMENTED');
  }
}

function buildCustomizations(options: CartItemOption[]): Record<string, { uuid: string; price: number; quantity: number; title: string }[]> {
  const result: Record<string, { uuid: string; price: number; quantity: number; title: string }[]> = {};
  for (const opt of options) {
    const key = `${opt.group_id}+0`;
    if (!result[key]) result[key] = [];
    result[key].push({ uuid: opt.option_id, price: 0, quantity: 1, title: '' });
  }
  return result;
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/ubereats-client typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ubereats-client/src/client.ts
git commit -m "feat(ubereats-client): implement UberEatsClient (placeOrder/cancelOrder stubs)"
```

---

## Task 6: [MANUAL GATE] Capture Thuisbezorgd API

Before writing the Thuisbezorgd client, capture API traffic from `thuisbezorgd.nl`.

- [ ] **Step 1: Start mitmproxy on the Linux box**

```bash
cd /path/to/OrderFood/tools/api-capture
.venv/bin/mitmdump -s capture.py --listen-port 8080
```

- [ ] **Step 2: Set phone proxy to Linux box IP:8080, install mitmproxy cert**

Follow `tools/api-capture/README.md`.

- [ ] **Step 3: Open `https://www.thuisbezorgd.nl` in Safari on iPhone**

Browse: enter address → search restaurants → open a restaurant → add an item to cart.

Also visit: order history page, payment methods page.

- [ ] **Step 4: Copy output files to Mac**

```bash
scp -r user@linux-box:/path/to/OrderFood/tools/api-capture/output/thuisbezorgd/ tools/api-capture/output/
```

- [ ] **Step 5: Generate API reference**

```bash
cd /path/to/OrderFood/tools/api-capture
pnpm parse:thuisbezorgd
```

Expected: `docs/api-reference/thuisbezorgd.md` populated.

- [ ] **Step 6: Document discovered endpoints in `docs/api-reference/thuisbezorgd.md`**

Add a summary section at the top with: base URL, auth method, key endpoint names + request/response shapes for: address search, restaurant search, restaurant+menu, add to cart, get cart, place order, order status, payment methods.

---

## Task 7: Thuisbezorgd client

**Files:**
- Create: `packages/thuisbezorgd-client/src/auth.ts`
- Create: `packages/thuisbezorgd-client/src/types.ts`
- Create: `packages/thuisbezorgd-client/src/mappers.ts`
- Create: `packages/thuisbezorgd-client/src/client.ts`
- Create: `packages/thuisbezorgd-client/tests/mappers.test.ts`

Follow the exact same pattern as Task 2–5 for ubereats-client, adapted to the Thuisbezorgd API discovered in Task 6.

Key expected differences from Uber Eats (to verify against capture):
- Auth may be a Bearer token (Thuisbezorgd uses JWT in Authorization header) vs cookies
- Base URL: likely `https://api.thuisbezorgd.nl` or similar
- Restaurant IDs may be numeric or slugs

- [ ] **Step 1: Implement auth.ts** (copy ubereats auth.ts, change `PLATFORM = 'thuisbezorgd'`)
- [ ] **Step 2: Implement types.ts** (based on captured response shapes)
- [ ] **Step 3: Write mappers.test.ts** (same structure as ubereats mappers test)
- [ ] **Step 4: Run to verify failing**
- [ ] **Step 5: Implement mappers.ts**
- [ ] **Step 6: Run to verify passing**
- [ ] **Step 7: Implement client.ts**
- [ ] **Step 8: Typecheck**
- [ ] **Step 9: Commit**

---

## Task 8: MCP server config + entry point

**Files:**
- Create: `packages/mcp-server/src/config.ts`
- Create: `packages/mcp-server/src/index.ts`

- [ ] **Step 1: Implement `packages/mcp-server/src/config.ts`**

```typescript
import { UberEatsClient } from '@orderfood/ubereats-client';
import { ThuisbezorgdClient } from '@orderfood/thuisbezorgd-client';
import type { PlatformClient } from '@orderfood/shared';

export function getClient(platform: 'ubereats' | 'thuisbezorgd'): PlatformClient {
  switch (platform) {
    case 'ubereats': return new UberEatsClient();
    case 'thuisbezorgd': return new ThuisbezorgdClient();
  }
}
```

- [ ] **Step 2: Implement `packages/mcp-server/src/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerCartTools } from './tools/cart.js';
import { registerOrderTools } from './tools/orders.js';
import { registerAccountTools } from './tools/account.js';

const server = new McpServer({
  name: 'orderfood',
  version: '0.1.0',
});

registerDiscoveryTools(server);
registerCartTools(server);
registerOrderTools(server);
registerAccountTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/config.ts packages/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add server entry point and config"
```

---

## Task 9: MCP discovery tools

**Files:**
- Create: `packages/mcp-server/src/tools/discovery.ts`

- [ ] **Step 1: Implement `packages/mcp-server/src/tools/discovery.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);

export function registerDiscoveryTools(server: McpServer): void {
  server.tool(
    'search_restaurants',
    'Search for restaurants on the specified food delivery platform near a location. Optionally filter by cuisine type or keyword, and sort results.',
    {
      platform: platformSchema,
      location: z.string().describe('Delivery address, e.g. "Amsterdam Centraal"'),
      cuisine: z.string().optional().describe('Cuisine filter, e.g. "Italian"'),
      query: z.string().optional().describe('Free-text keyword search'),
      sort_by: z.enum(['rating', 'delivery_time', 'delivery_fee']).optional(),
    },
    async ({ platform, location, cuisine, query, sort_by }) => {
      try {
        const client = getClient(platform);
        const results = await client.searchRestaurants({ location, cuisine, query, sort_by });
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      } catch (e: unknown) {
        return errorResponse(e);
      }
    },
  );

  server.tool(
    'get_restaurant',
    'Get full details for a restaurant including its categorized menu, item prices, and modifier option groups.',
    {
      platform: platformSchema,
      restaurant_id: z.string(),
    },
    async ({ platform, restaurant_id }) => {
      try {
        const client = getClient(platform);
        const result = await client.getRestaurant(restaurant_id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) {
        return errorResponse(e);
      }
    },
  );
}

function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }],
    isError: true,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/mcp-server typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/tools/discovery.ts
git commit -m "feat(mcp-server): add search_restaurants and get_restaurant tools"
```

---

## Task 10: MCP cart tools

**Files:**
- Create: `packages/mcp-server/src/tools/cart.ts`

- [ ] **Step 1: Implement `packages/mcp-server/src/tools/cart.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);

function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }],
    isError: true,
  };
}

export function registerCartTools(server: McpServer): void {
  server.tool(
    'get_cart',
    'Get the current cart state on the specified platform, including items, quantities, selected options, and price totals. Returns null if the cart is empty.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        const result = await getClient(platform).getCart();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'add_to_cart',
    'Add a menu item to the cart on the specified platform. Provide option selections as { group_id, option_id } pairs. Required option groups must be satisfied.',
    {
      platform: platformSchema,
      restaurant_id: z.string(),
      item_id: z.string(),
      quantity: z.number().int().min(1),
      options: z.array(z.object({ group_id: z.string(), option_id: z.string() })).optional(),
    },
    async ({ platform, restaurant_id, item_id, quantity, options }) => {
      try {
        const result = await getClient(platform).addToCart(restaurant_id, item_id, quantity, options);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'clear_cart',
    'Remove all items from the cart on the specified platform.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        await getClient(platform).clearCart();
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );
}
```

- [ ] **Step 2: Typecheck**
- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/tools/cart.ts
git commit -m "feat(mcp-server): add get_cart, add_to_cart, clear_cart tools"
```

---

## Task 11: MCP order + account tools

**Files:**
- Create: `packages/mcp-server/src/tools/orders.ts`
- Create: `packages/mcp-server/src/tools/account.ts`

- [ ] **Step 1: Implement `packages/mcp-server/src/tools/orders.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);
function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }], isError: true };
}

export function registerOrderTools(server: McpServer): void {
  server.tool(
    'place_order',
    'Place the current cart as a delivery order to the specified address using the specified payment method. Returns the created order.',
    {
      platform: platformSchema,
      address_id: z.string().describe('Address ID from get_saved_addresses, or a free-form address string'),
      payment_method_id: z.string().describe('Payment method UUID from get_payment_methods'),
    },
    async ({ platform, address_id, payment_method_id }) => {
      try {
        const result = await getClient(platform).placeOrder(address_id, payment_method_id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'track_order',
    'Get the current delivery status of an order.',
    { platform: platformSchema, order_id: z.string() },
    async ({ platform, order_id }) => {
      try {
        const result = await getClient(platform).trackOrder(order_id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'get_order_history',
    'Retrieve past orders for the authenticated account on the specified platform.',
    {
      platform: platformSchema,
      limit: z.number().int().min(1).max(50).optional().default(10),
    },
    async ({ platform, limit }) => {
      try {
        const result = await getClient(platform).getOrderHistory(limit);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'cancel_order',
    'Cancel an order if it is still within the cancellable window. Throws if cancellation is no longer possible.',
    { platform: platformSchema, order_id: z.string() },
    async ({ platform, order_id }) => {
      try {
        await getClient(platform).cancelOrder(order_id);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );
}
```

- [ ] **Step 2: Implement `packages/mcp-server/src/tools/account.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../config.js';

const platformSchema = z.enum(['ubereats', 'thuisbezorgd']);
function errorResponse(e: unknown) {
  const err = e as { message?: string; code?: string };
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code ?? 'UNKNOWN' }) }], isError: true };
}

export function registerAccountTools(server: McpServer): void {
  server.tool(
    'get_saved_addresses',
    'List saved delivery addresses for the authenticated account on the specified platform.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        const result = await getClient(platform).getSavedAddresses();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );

  server.tool(
    'get_payment_methods',
    'List saved payment methods for the authenticated account. Use the returned id values when calling place_order.',
    { platform: platformSchema },
    async ({ platform }) => {
      try {
        const result = await getClient(platform).getPaymentMethods();
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) { return errorResponse(e); }
    },
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /path/to/OrderFood && pnpm --filter @orderfood/mcp-server typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-server/src/tools/orders.ts packages/mcp-server/src/tools/account.ts
git commit -m "feat(mcp-server): add order and account tools"
```

---

## Task 12: Setup CLI

**Files:**
- Create: `packages/mcp-server/src/setup.ts`

The setup CLI accepts session cookies copied from browser DevTools and stores them encrypted.

- [ ] **Step 1: Implement `packages/mcp-server/src/setup.ts`**

```typescript
#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { saveCredentials } from '@orderfood/ubereats-client/dist/auth.js';

const args = process.argv.slice(2);
const platformIdx = args.indexOf('--platform');
const platform = platformIdx >= 0 ? args[platformIdx + 1] : null;

if (!platform || !['ubereats', 'thuisbezorgd'].includes(platform)) {
  console.error('Usage: npx orderfood setup --platform ubereats|thuisbezorgd');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log(`\nOrderFood Setup — ${platform}\n`);
console.log('1. Open https://www.ubereats.com (or thuisbezorgd.nl) in your browser');
console.log('2. Log in to your account');
console.log('3. Open DevTools → Application → Cookies');
console.log('4. Copy the following cookies as a JSON object: jwt-session, uev2.id.session, uev2.id.session_v2, uev2.ts.session, uev2.ts.session_v2, _ua, dId, uev2.id.xp');
console.log('\nPaste the cookies JSON and press Enter (format: {"jwt-session": "...", ...}):');

rl.on('line', async (line) => {
  rl.close();
  try {
    const cookies = JSON.parse(line.trim());
    if (platform === 'ubereats') {
      await saveCredentials({
        access_token: '',
        refresh_token: '',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        cookies,
      });
    }
    // TODO: thuisbezorgd save
    console.log(`\n✓ Credentials saved to ~/.orderfood/${platform}.json`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to parse cookies JSON:', e);
    process.exit(1);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-server/src/setup.ts
git commit -m "feat(mcp-server): add setup CLI for credential bootstrap"
```

---

## Task 13: Build all packages

- [ ] **Step 1: Build**

```bash
cd /path/to/OrderFood && pnpm build
```

Expected: All packages compile without errors.

- [ ] **Step 2: Register MCP server in Claude Code**

```bash
claude mcp add orderfood -- node packages/mcp-server/dist/index.js
```

- [ ] **Step 3: Bootstrap credentials**

```bash
npx orderfood setup --platform ubereats
```

Follow on-screen instructions to paste session cookies from browser DevTools.

- [ ] **Step 4: Smoke test via Claude Code**

Test prompts:
- "Find Italian restaurants near Amsterdam Centraal on Uber Eats"
- "Show me the menu for [restaurant_id from first result]"
- "What are my payment methods on Uber Eats?"
- "Add a [item] to my Uber Eats cart"

Expected: All tools return real data. `place_order` returns a clear "NOT_IMPLEMENTED" error with instructions for the second capture session.

- [ ] **Step 5: Commit build artifacts config**

```bash
git add .
git commit -m "feat: build all packages, register MCP server"
```

---

## Task 14: [FOLLOW-UP] Capture order placement endpoint

This is a separate mini-capture needed specifically to discover `submitDraftOrderV2` (or whatever the real endpoint is called).

- [ ] **Step 1: Start mitmproxy and add a real item to cart via the web app**
- [ ] **Step 2: Proceed through checkout and press "Place Order"**
- [ ] **Step 3: Find the submit endpoint in `tools/api-capture/output/ubereats/`**

```bash
python3 -c "
import json, glob
for f in glob.glob('*.json'):
    d = json.loads(open(f).read())
    url = d.get('url','')
    if '/_p/api/' in url and 'submit' in url.lower() or 'place' in url.lower() or 'checkout' in url.lower():
        print(url, d.get('request_body','')[:200])
"
```

- [ ] **Step 4: Update `client.ts` placeOrder() with the real endpoint + request shape**
- [ ] **Step 5: Test end-to-end with "Place my current Uber Eats order to my home address"**
- [ ] **Step 6: Commit**
