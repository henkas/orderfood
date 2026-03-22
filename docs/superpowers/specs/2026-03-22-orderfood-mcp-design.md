# OrderFood MCP — Design Specification

**Date:** 2026-03-22
**Authors:** henkipapp + Dante (Codex)
**Status:** Approved

---

## Problem

AI agents currently have no way to interact with food delivery platforms. This project creates an MCP server that lets agents search restaurants, browse menus, and place orders on Uber Eats and Thuisbezorgd — enabling natural language food ordering ("order me a pizza from the nearest Italian place").

**Legal basis:** EU Directive 2009/24/EC Article 6 explicitly permits reverse engineering for interoperability purposes, provided it is not for commercial gain. This project is personal use + open-source research/demo.

---

## Solution

A TypeScript monorepo MCP server with:
- `@orderfood/shared` — normalized types used across all packages
- `@orderfood/ubereats-client` — Uber Eats REST client (discovered via mitmproxy)
- `@orderfood/thuisbezorgd-client` — Thuisbezorgd REST client (discovered via mitmproxy)
- `@orderfood/mcp-server` — MCP server exposing 11 tools to AI agents
- `tools/api-capture/` — mitmproxy tooling for Phase 1 API discovery

---

## Repository Structure

```
orderfood/
├── packages/
│   ├── shared/
│   │   └── src/
│   │       ├── types.ts          # Restaurant, MenuItem, Cart, Order, Address, OrderStatus
│   │       └── errors.ts         # PlatformError, AuthError, RateLimitError, NotFoundError
│   ├── ubereats-client/
│   │   └── src/
│   │       ├── client.ts         # UberEatsClient implements PlatformClient
│   │       ├── auth.ts           # Token management + auto-refresh
│   │       ├── mappers.ts        # UE API response → shared types
│   │       └── types.ts          # UE-specific response shapes
│   ├── thuisbezorgd-client/
│   │   └── src/
│   │       ├── client.ts         # ThuisbezorgdClient implements PlatformClient
│   │       ├── auth.ts
│   │       ├── mappers.ts        # TB API response → shared types
│   │       └── types.ts
│   └── mcp-server/
│       └── src/
│           ├── index.ts          # McpServer entry point
│           ├── config.ts         # Credential loading + client init
│           └── tools/
│               ├── discovery.ts  # search_restaurants, get_restaurant
│               ├── cart.ts       # get_cart, add_to_cart, clear_cart
│               ├── orders.ts     # place_order, track_order, get_order_history, cancel_order
│               └── account.ts   # get_saved_addresses, get_payment_methods
├── tools/
│   └── api-capture/
│       ├── capture.py            # mitmproxy addon script (writes JSON directly, not HAR)
│       ├── parse_captured.ts     # Parse captured JSON → endpoint reference docs
│       └── README.md             # iOS/Android proxy setup guide
├── docs/
│   └── api-reference/
│       ├── ubereats.md           # Discovered UE endpoints (populated after capture)
│       └── thuisbezorgd.md       # Discovered TB endpoints (populated after capture)
├── package.json                  # pnpm workspaces root
├── tsconfig.base.json
└── README.md
```

---

## Shared Types

```typescript
// packages/shared/src/types.ts

export type Platform = 'ubereats' | 'thuisbezorgd';

// --- Restaurants & Menus ---

export interface Restaurant {
  id: string;
  platform: Platform;
  name: string;
  cuisine: string[];
  rating: number;
  delivery_time_min: number;
  delivery_fee: number;
  min_order: number;
  image_url?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  price_delta: number;   // in cents; 0 = free
}

export interface MenuOptionGroup {
  id: string;
  name: string;           // e.g. "Choose your size"
  required: boolean;
  min_selections: number; // usually 1 if required, 0 if optional
  max_selections: number; // usually 1 for radio, N for checkbox
  options: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;          // base price in cents
  category: string;       // category name for display only
  option_groups: MenuOptionGroup[];
  image_url?: string;
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface RestaurantWithMenu extends Restaurant {
  categories: MenuCategory[];
}

// --- Cart ---

export interface CartItemOption {
  group_id: string;
  option_id: string;
}

export interface CartItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;     // in cents
  selected_options: CartItemOption[];
}

export interface Cart {
  restaurant_id: string;
  platform: Platform;
  items: CartItem[];
  subtotal: number;       // in cents
  delivery_fee: number;   // in cents
  total: number;          // in cents
}

// --- Orders ---

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  platform: Platform;
  status: OrderStatus;
  restaurant_name: string;
  items: CartItem[];
  total: number;          // in cents
  placed_at: string;      // ISO 8601
  estimated_delivery?: string; // ISO 8601
}

// --- Account ---

export interface Address {
  id: string;
  label?: string;
  formatted: string;
  lat?: number;
  lng?: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'ideal' | 'cash' | 'other';
  label: string;          // e.g. "Visa •••• 4242"
  is_default: boolean;
}

// --- Client interface ---

export interface SearchParams {
  location: string;
  cuisine?: string;
  query?: string;
  sort_by?: 'rating' | 'delivery_time' | 'delivery_fee';
}

export interface PlatformClient {
  searchRestaurants(params: SearchParams): Promise<Restaurant[]>;
  getRestaurant(restaurantId: string): Promise<RestaurantWithMenu>;
  getCart(): Promise<Cart | null>;
  addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[]
  ): Promise<Cart>;
  clearCart(): Promise<void>;
  getSavedAddresses(): Promise<Address[]>;
  getPaymentMethods(): Promise<PaymentMethod[]>;
  placeOrder(addressId: string, paymentMethodId: string): Promise<Order>;
  trackOrder(orderId: string): Promise<{ status: OrderStatus; details: string }>;
  getOrderHistory(limit?: number): Promise<Order[]>;
  cancelOrder(orderId: string): Promise<void>;
}
```

---

## MCP Tools — Full Schemas

All monetary values are returned in **cents** (integers) to avoid floating point. All timestamps are ISO 8601 strings.

### `search_restaurants`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)
  location:  string                        (required) e.g. "Amsterdam Centraal"
  cuisine:   string                        (optional) e.g. "Italian"
  query:     string                        (optional) free-text search
  sort_by:   "rating" | "delivery_time" | "delivery_fee"  (optional, default: "rating")

Output: Restaurant[]

Description: "Search for restaurants on the specified food delivery platform near a location.
Optionally filter by cuisine type or keyword, and sort results."
```

### `get_restaurant`
```
Input:
  platform:       "ubereats" | "thuisbezorgd"  (required)
  restaurant_id:  string                        (required)

Output: RestaurantWithMenu  (restaurant details + categories[] with items[] each with option_groups[])

Description: "Get full details for a restaurant including its categorized menu, item prices,
and modifier option groups (e.g. size choices, toppings)."
```

### `get_cart`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)

Output: Cart | null  (null if cart is empty)

Description: "Get the current cart state on the specified platform, including items, quantities,
selected options, and price totals. Returns null if the cart is empty."
```

### `add_to_cart`
```
Input:
  platform:       "ubereats" | "thuisbezorgd"  (required)
  restaurant_id:  string                        (required)
  item_id:        string                        (required)
  quantity:       number (integer >= 1)         (required)
  options:        Array<{ group_id: string, option_id: string }>  (optional)
                  Must satisfy each MenuOptionGroup's required/min/max constraints.

Output: Cart  (updated cart state)

Description: "Add a menu item to the cart on the specified platform. Provide option selections
as { group_id, option_id } pairs. Required option groups must be satisfied or the call will fail
with a validation error."
```

### `clear_cart`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)

Output: { success: true }

Description: "Remove all items from the cart on the specified platform."
```

### `get_saved_addresses`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)

Output: Address[]

Description: "List saved delivery addresses for the authenticated account on the specified platform."
```

### `get_payment_methods`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)

Output: PaymentMethod[]

Description: "List saved payment methods for the authenticated account. Use the returned id
values when calling place_order."
```

### `place_order`
```
Input:
  platform:           "ubereats" | "thuisbezorgd"  (required)
  address_id:         string  (required) — from get_saved_addresses
  payment_method_id:  string  (required) — from get_payment_methods

Output: Order

Description: "Place the current cart as a delivery order to the specified address using the
specified payment method. Returns the created order with its id and initial status."
```

### `track_order`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)
  order_id:  string                        (required)

Output: { status: OrderStatus, details: string }
  status:  one of 'pending' | 'confirmed' | 'preparing' | 'picked_up' | 'delivered' | 'cancelled'
  details: human-readable status message (e.g. "Your order is being prepared")

Description: "Get the current delivery status of an order."
```

### `get_order_history`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)
  limit:     number (integer 1–50, optional, default: 10)

Output: Order[]  (most recent first)

Description: "Retrieve past orders for the authenticated account on the specified platform."
```

### `cancel_order`
```
Input:
  platform:  "ubereats" | "thuisbezorgd"  (required)
  order_id:  string                        (required)

Output: { success: true }
Throws: PlatformError if cancellation window has passed

Description: "Cancel an order if it is still within the cancellable window (typically before
the restaurant confirms). Throws if cancellation is no longer possible."
```

---

## Auth & Credential Storage

### Credential File Format
Stored at `~/.orderfood/ubereats.json` and `~/.orderfood/thuisbezorgd.json`:

```json
{
  "iv": "<base64 nonce>",
  "ciphertext": "<base64 AES-256-GCM encrypted JSON>",
  "user_id": "<plaintext, used for logging only>"
}
```

The decrypted JSON payload:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": "<ISO 8601>"
}
```

### Encryption Spec
- Algorithm: AES-256-GCM
- Key derivation: HKDF-SHA256 with:
  - IKM: machine ID from `node-machine-id` (hex string)
  - Salt: static string `"orderfood-v1"`
  - Info: platform name (`"ubereats"` or `"thuisbezorgd"`)
  - Output length: 32 bytes
- IV: 12-byte random nonce, freshly generated on each write, stored in the file

### First-Run / Credential Bootstrap

New users run the setup CLI before starting the MCP server:

```bash
npx orderfood setup --platform ubereats
npx orderfood setup --platform thuisbezorgd
```

This command:
1. Opens a browser to the platform's web login page
2. Launches a local HTTP server at `http://localhost:9876`
3. After login, the user copies their session token from browser DevTools (Network tab) — the README provides step-by-step instructions with screenshots
4. The CLI accepts the token, stores it encrypted at `~/.orderfood/{platform}.json`
5. Verifies the token works by calling a lightweight profile endpoint

*(Note: A fully automated OAuth flow may be possible after API capture — this is a fallback that works even without it.)*

### Token Refresh
- Client checks `expires_at` before each request
- If within 60 seconds of expiry or already expired: calls refresh endpoint first
- If refresh fails: throws `AuthError` with message instructing user to re-run setup
- Rate limit response (`429`): surfaces `RateLimitError` immediately with `retry_after` seconds — **no automatic retry**; the MCP tool returns the error so the agent can decide whether to wait

---

## Cart Ownership

Carts are **server-side** — managed by the platform, not in local memory. `getCart()` calls the platform's cart API and returns the current state. `addToCart()` calls the platform's add-to-cart API. This means:
- Cart state persists across sessions and devices
- `clearCart()` calls the platform's remove-all-items endpoint
- No local cart state is maintained in the MCP server

---

## Phase 1: API Capture Workflow

API discovery precedes client implementation. Clients are built against real platform behavior captured from the official mobile apps.

### capture.py

The mitmproxy addon writes structured JSON directly (no HAR export needed):

```python
# tools/api-capture/capture.py
# Filters to *.ubereats.com and *.thuisbezorgd.nl
# Writes to tools/api-capture/output/{platform}/{timestamp}.json
# Each entry: { method, url, request_headers, request_body, response_status, response_body }
```

### Run capture
```bash
pip install mitmproxy
mitmproxy -s tools/api-capture/capture.py
# Install cert on mobile: http://mitm.it (while proxied through mitmproxy)
# Set device proxy to <machine-ip>:8080
# Use the app: search → browse → add to cart → checkout
```

### Extract endpoint reference
```bash
npx ts-node tools/api-capture/parse_captured.ts \
  --input tools/api-capture/output/ubereats/ \
  --output docs/api-reference/ubereats.md
```

Dante can run the same capture independently and compare results.

---

## Error Types

```typescript
// packages/shared/src/errors.ts

export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) { super(message); }
}

export class AuthError extends PlatformError {}    // Cannot refresh; re-run setup
export class NotFoundError extends PlatformError {} // Restaurant/item/order not found
export class ValidationError extends PlatformError {} // e.g. unsatisfied required option group

export class RateLimitError extends PlatformError {
  constructor(message: string, public readonly retry_after: number) {
    super(message, 'RATE_LIMITED');
  }
}
```

All MCP tools catch these and return:
```json
{ "error": "human readable message", "code": "AUTH_ERROR | NOT_FOUND | RATE_LIMITED | ..." }
```

---

## Implementation Sequence

1. Repo bootstrap: pnpm workspace, tsconfig.base.json, per-package package.json files
2. `@orderfood/shared`: types.ts + errors.ts
3. `tools/api-capture/`: capture.py + parse_captured.ts + README
4. **[Manual step]** Run captures on both platforms → populate `docs/api-reference/`
5. `@orderfood/ubereats-client`: auth.ts → types.ts → mappers.ts → client.ts
6. `@orderfood/thuisbezorgd-client`: same sequence
7. `@orderfood/mcp-server`: config.ts → tool files → index.ts
8. Setup CLI (`npx orderfood setup`) in `packages/mcp-server/src/setup.ts`
9. `pnpm build` — compile all packages
10. Integration testing via Claude Code with MCP server registered
11. README + open-source prep (contributing guide, LICENSE)

---

## Verification

```bash
# Build
pnpm build

# Bootstrap credentials (one-time)
npx orderfood setup --platform ubereats
npx orderfood setup --platform thuisbezorgd

# Register MCP server
claude mcp add orderfood -- node packages/mcp-server/dist/index.js

# Test discovery
# Prompt: "Find Italian restaurants near Amsterdam Centraal on Thuisbezorgd"

# Test cart
# Prompt: "Show me the menu for [restaurant], then add a Margherita to my Uber Eats cart"

# Test account + ordering
# Prompt: "What are my saved addresses and payment methods on Uber Eats?"
# Prompt: "Place my current Uber Eats order to my home address"

# Test tracking
# Prompt: "Where's my Thuisbezorgd order?"
```
