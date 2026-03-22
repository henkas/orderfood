# OrderFood Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the monorepo, implement `@orderfood/shared` types/errors, and build the mitmproxy capture tooling — everything needed to run API discovery before writing any platform client code.

**Architecture:** pnpm workspace monorepo with `packages/shared` as the shared type library, and `tools/api-capture/` as standalone Python + TypeScript tooling. No platform clients yet — those come in Plan 2 after API shapes are known from capture.

**Tech Stack:** pnpm workspaces, TypeScript 5 (strict, ESM), Vitest for tests, tsx for running TS scripts, Python 3 + mitmproxy for capture.

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | pnpm workspace root, shared dev deps |
| `pnpm-workspace.yaml` | Declares workspace members |
| `tsconfig.base.json` | Shared TS compiler options (strict, NodeNext, ESM) |
| `.gitignore` | Ignores node_modules, dist, capture output |
| `packages/shared/package.json` | `@orderfood/shared` package manifest |
| `packages/shared/tsconfig.json` | Extends base, scoped to src/ |
| `packages/shared/src/types.ts` | All shared interfaces: Restaurant, MenuItem, Cart, Order, etc. |
| `packages/shared/src/errors.ts` | Error hierarchy: PlatformError, AuthError, RateLimitError, etc. |
| `packages/shared/src/index.ts` | Re-exports everything from types.ts and errors.ts |
| `packages/shared/tests/errors.test.ts` | Unit tests for error class behavior |
| `tools/api-capture/package.json` | Capture tool manifest (tsx, vitest) |
| `tools/api-capture/tsconfig.json` | Extends base |
| `tools/api-capture/capture.py` | mitmproxy addon: filters UE/TB traffic, writes JSON entries |
| `tools/api-capture/parse_captured.ts` | Reads captured JSON → grouped markdown reference docs |
| `tools/api-capture/tests/parse_captured.test.ts` | Unit tests for pure functions in parse_captured |
| `tools/api-capture/README.md` | iOS/Android proxy setup walkthrough |
| `docs/api-reference/ubereats.md` | Placeholder (populated after manual capture step) |
| `docs/api-reference/thuisbezorgd.md` | Placeholder |
| `README.md` | Project overview + quick start |

---

## Task 1: Repo Bootstrap

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Verify pnpm is installed**

```bash
pnpm --version
```
Expected: `8.x.x` or higher. If missing: `npm install -g pnpm`

- [ ] **Step 2: Initialize git**

```bash
cd /Users/henkipapp/VSCode/Personal/OrderFood
git init
```
Expected: `Initialized empty Git repository in .../OrderFood/.git/`

- [ ] **Step 3: Create `.gitignore`**

Create `/.gitignore`:
```
node_modules/
dist/
*.tsbuildinfo
tools/api-capture/output/
.env
```

- [ ] **Step 4: Create root `package.json`**

Create `/package.json`:
```json
{
  "name": "orderfood",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "tsx": "^4.10.0"
  }
}
```

- [ ] **Step 5: Create `pnpm-workspace.yaml`**

Create `/pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'tools/api-capture'
```

- [ ] **Step 6: Create `tsconfig.base.json`**

Create `/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 7: Install root dev deps**

```bash
pnpm install
```
Expected: Lockfile created, `node_modules/.pnpm` populated.

- [ ] **Step 8: Initial commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: bootstrap pnpm workspace"
```

---

## Task 2: @orderfood/shared — Package Scaffold

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`

- [ ] **Step 1: Create directories**

```bash
mkdir -p packages/shared/src packages/shared/tests
```

- [ ] **Step 2: Create `packages/shared/package.json`**

```json
{
  "name": "@orderfood/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Install from repo root**

```bash
cd /Users/henkipapp/VSCode/Personal/OrderFood && pnpm install
```
Expected: Lockfile updated, `packages/shared/node_modules` populated.

---

## Task 3: @orderfood/shared — Error Classes (TDD)

**Files:**
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/tests/errors.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `packages/shared/tests/errors.test.ts`:
```typescript
import { describe, test, expect } from 'vitest';
import {
  PlatformError,
  AuthError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from '../src/errors.js';

describe('PlatformError', () => {
  test('extends Error with code and statusCode', () => {
    const err = new PlatformError('test message', 'TEST_CODE', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('PlatformError');
  });

  test('works without statusCode', () => {
    const err = new PlatformError('msg', 'CODE');
    expect(err.statusCode).toBeUndefined();
  });
});

describe('AuthError', () => {
  test('is a PlatformError with correct name', () => {
    const err = new AuthError('auth failed', 'AUTH_ERROR');
    expect(err).toBeInstanceOf(PlatformError);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe('AuthError');
  });
});

describe('NotFoundError', () => {
  test('is a PlatformError', () => {
    const err = new NotFoundError('not found', 'NOT_FOUND', 404);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('NotFoundError');
  });
});

describe('ValidationError', () => {
  test('is a PlatformError', () => {
    const err = new ValidationError('invalid options', 'VALIDATION_ERROR');
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.name).toBe('ValidationError');
  });
});

describe('RateLimitError', () => {
  test('has retry_after and fixed RATE_LIMITED code', () => {
    const err = new RateLimitError('slow down', 30);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.retry_after).toBe(30);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.name).toBe('RateLimitError');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd packages/shared && pnpm test
```
Expected: FAIL — `Cannot find module '../src/errors.js'`

- [ ] **Step 3: Implement `packages/shared/src/errors.ts`**

```typescript
export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PlatformError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends PlatformError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends PlatformError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string, code: string, statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends PlatformError {
  constructor(
    message: string,
    public readonly retry_after: number,
  ) {
    super(message, 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd packages/shared && pnpm test
```
Expected: All 8 tests PASS.

---

## Task 4: @orderfood/shared — Types + Index

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

*(Types are pure interfaces — no runtime behavior to unit test. Compilation is the test.)*

- [ ] **Step 1: Create `packages/shared/src/types.ts`**

```typescript
export type Platform = 'ubereats' | 'thuisbezorgd';

// --- Restaurants & Menus ---

export interface Restaurant {
  id: string;
  platform: Platform;
  name: string;
  cuisine: string[];
  rating: number;
  delivery_time_min: number;
  delivery_fee: number;   // cents
  min_order: number;      // cents
  image_url?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  price_delta: number;   // cents; 0 = free
}

export interface MenuOptionGroup {
  id: string;
  name: string;           // e.g. "Choose your size"
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;          // base price in cents
  category: string;
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
  unit_price: number;             // cents
  selected_options: CartItemOption[];
}

export interface Cart {
  restaurant_id: string;
  platform: Platform;
  items: CartItem[];
  subtotal: number;               // cents
  delivery_fee: number;           // cents
  total: number;                  // cents
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
  total: number;                  // cents
  placed_at: string;              // ISO 8601
  estimated_delivery?: string;    // ISO 8601
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
  label: string;                  // e.g. "Visa •••• 4242"
  is_default: boolean;
}

// --- Client contract ---

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
    options?: CartItemOption[],
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

- [ ] **Step 2: Create `packages/shared/src/index.ts`**

```typescript
export * from './types.js';
export * from './errors.js';
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/shared && pnpm typecheck
```
Expected: No errors.

- [ ] **Step 4: Build**

```bash
cd packages/shared && pnpm build
```
Expected: `dist/` created with `.js` and `.d.ts` files.

- [ ] **Step 5: Commit**

```bash
cd /Users/henkipapp/VSCode/Personal/OrderFood
git add packages/shared/
git commit -m "feat: add @orderfood/shared types and errors"
```

---

## Task 5: api-capture — Package Scaffold

**Files:**
- Create: `tools/api-capture/package.json`
- Create: `tools/api-capture/tsconfig.json`

- [ ] **Step 1: Create directories**

```bash
mkdir -p tools/api-capture/tests tools/api-capture/output
touch tools/api-capture/output/.gitkeep
```

- [ ] **Step 2: Create `tools/api-capture/package.json`**

```json
{
  "name": "@orderfood/api-capture",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "parse:ubereats": "tsx parse_captured.ts --input output/ubereats --output ../../docs/api-reference/ubereats.md",
    "parse:thuisbezorgd": "tsx parse_captured.ts --input output/thuisbezorgd --output ../../docs/api-reference/thuisbezorgd.md"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "tsx": "^4.10.0"
  }
}
```

- [ ] **Step 3: Create `tools/api-capture/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["./*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Install from repo root**

```bash
cd /Users/henkipapp/VSCode/Personal/OrderFood && pnpm install
```
Expected: Lockfile updated, `tools/api-capture/node_modules` populated.

---

## Task 6: capture.py — mitmproxy Addon

**Files:**
- Create: `tools/api-capture/capture.py`

- [ ] **Step 1: Install mitmproxy**

```bash
pip install mitmproxy
python3 -c "import mitmproxy; print(mitmproxy.__version__)"
```
Expected: prints version number e.g. `10.x.x`. If `pip` not found use `pip3`.

- [ ] **Step 2: Create `tools/api-capture/capture.py`**

```python
"""
mitmproxy addon for capturing Uber Eats and Thuisbezorgd API traffic.

Usage:
    mitmproxy -s tools/api-capture/capture.py

Each intercepted response is written as a JSON file to:
    tools/api-capture/output/{platform}/{YYYYMMDDTHHMMSSF}.json

Entry schema:
    { method, url, request_headers, request_body,
      response_status, response_body }
"""
import json
import os
from datetime import datetime, timezone

from mitmproxy import http

PLATFORMS: dict[str, list[str]] = {
    "ubereats": ["ubereats.com"],
    "thuisbezorgd": ["thuisbezorgd.nl", "thuisbezorgd.com"],
}

_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def _platform_for_host(host: str) -> str | None:
    for platform, domains in PLATFORMS.items():
        if any(domain in host for domain in domains):
            return platform
    return None


def response(flow: http.HTTPFlow) -> None:
    platform = _platform_for_host(flow.request.host)
    if platform is None:
        return

    platform_dir = os.path.join(_OUTPUT_DIR, platform)
    os.makedirs(platform_dir, exist_ok=True)

    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    filename = os.path.join(platform_dir, f"{timestamp}.json")

    try:
        request_body = flow.request.get_text(strict=False) or ""
    except Exception:
        request_body = "<binary>"

    try:
        response_body = (
            flow.response.get_text(strict=False) if flow.response else ""
        ) or ""
    except Exception:
        response_body = "<binary>"

    entry = {
        "method": flow.request.method,
        "url": flow.request.pretty_url,
        "request_headers": dict(flow.request.headers),
        "request_body": request_body,
        "response_status": flow.response.status_code if flow.response else None,
        "response_body": response_body,
    }

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(entry, f, indent=2, ensure_ascii=False)

    print(f"[orderfood] captured {flow.request.method} {flow.request.pretty_url[:80]}")
```

- [ ] **Step 3: Syntax check**

*(Requires mitmproxy installed from Step 1 — `py_compile` triggers the import)*

```bash
python3 -m py_compile tools/api-capture/capture.py && echo "capture.py OK"
```
Expected: `capture.py OK`

---

## Task 7: parse_captured.ts — Parser (TDD)

**Files:**
- Create: `tools/api-capture/parse_captured.ts`
- Create: `tools/api-capture/tests/parse_captured.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tools/api-capture/tests/parse_captured.test.ts`:
```typescript
import { describe, test, expect } from 'vitest';
import {
  toPattern,
  groupByPattern,
  renderMarkdown,
  type CapturedEntry,
} from '../parse_captured.js';

const makeEntry = (overrides: Partial<CapturedEntry> = {}): CapturedEntry => ({
  method: 'GET',
  url: 'https://api.ubereats.com/v1/feed',
  request_headers: {},
  request_body: '',
  response_status: 200,
  response_body: '{}',
  ...overrides,
});

describe('toPattern', () => {
  test('replaces UUID path segments with {id}', () => {
    const url =
      'https://api.ubereats.com/v1/restaurants/550e8400-e29b-41d4-a716-446655440000/menu';
    expect(toPattern(url)).toBe(
      'https://api.ubereats.com/v1/restaurants/{id}/menu',
    );
  });

  test('replaces long numeric path segments with {id}', () => {
    const url = 'https://api.ubereats.com/v1/orders/12345678/status';
    expect(toPattern(url)).toBe(
      'https://api.ubereats.com/v1/orders/{id}/status',
    );
  });

  test('preserves short numeric query params', () => {
    const url = 'https://api.ubereats.com/v2/feed?page=1&limit=20';
    expect(toPattern(url)).toBe(
      'https://api.ubereats.com/v2/feed?page=1&limit=20',
    );
  });

  test('handles URLs with no IDs unchanged', () => {
    const url = 'https://api.ubereats.com/v1/categories';
    expect(toPattern(url)).toBe('https://api.ubereats.com/v1/categories');
  });
});

describe('groupByPattern', () => {
  test('collapses entries with same method+pattern into one group', () => {
    const entries: CapturedEntry[] = [
      makeEntry({ url: 'https://api.ubereats.com/v1/restaurants/abc-111/menu' }),
      makeEntry({ url: 'https://api.ubereats.com/v1/restaurants/def-222/menu' }),
    ];
    const groups = groupByPattern(entries);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0].examples).toHaveLength(2);
  });

  test('separates GET and POST to same URL', () => {
    const entries: CapturedEntry[] = [
      makeEntry({ method: 'GET', url: 'https://api.ubereats.com/v1/cart' }),
      makeEntry({ method: 'POST', url: 'https://api.ubereats.com/v1/cart' }),
    ];
    const groups = groupByPattern(entries);
    expect(groups.size).toBe(2);
  });

  test('keys are formatted as "METHOD url-pattern"', () => {
    const groups = groupByPattern([makeEntry()]);
    expect([...groups.keys()][0]).toBe(
      'GET https://api.ubereats.com/v1/feed',
    );
  });
});

describe('renderMarkdown', () => {
  test('includes platform name in heading', () => {
    const md = renderMarkdown('ubereats', groupByPattern([makeEntry()]));
    expect(md).toContain('# ubereats API Reference');
  });

  test('includes endpoint method and pattern', () => {
    const md = renderMarkdown('ubereats', groupByPattern([makeEntry()]));
    expect(md).toContain('GET https://api.ubereats.com/v1/feed');
  });

  test('includes response status', () => {
    const md = renderMarkdown(
      'ubereats',
      groupByPattern([makeEntry({ response_status: 200 })]),
    );
    expect(md).toContain('200');
  });

  test('renders valid JSON response body as fenced block', () => {
    const md = renderMarkdown(
      'ubereats',
      groupByPattern([makeEntry({ response_body: '{"name":"test"}' })]),
    );
    expect(md).toContain('```json');
    expect(md).toContain('"name"');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd tools/api-capture && pnpm test
```
Expected: FAIL — `Cannot find module '../parse_captured.js'`

- [ ] **Step 3: Implement `tools/api-capture/parse_captured.ts`**

```typescript
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface CapturedEntry {
  method: string;
  url: string;
  request_headers: Record<string, string>;
  request_body: string;
  response_status: number | null;
  response_body: string;
}

export interface EndpointGroup {
  method: string;
  pattern: string;
  examples: CapturedEntry[];
}

/** Replace UUID and long-numeric path segments with {id}. */
export function toPattern(url: string): string {
  return url
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '{id}',
    )
    .replace(/(\/|=)[0-9]{5,}/g, (m, sep) => `${sep}{id}`);
}

/** Group entries by "METHOD normalized-url-pattern". */
export function groupByPattern(
  entries: CapturedEntry[],
): Map<string, EndpointGroup> {
  const groups = new Map<string, EndpointGroup>();
  for (const entry of entries) {
    const pattern = toPattern(entry.url);
    const key = `${entry.method} ${pattern}`;
    if (!groups.has(key)) {
      groups.set(key, { method: entry.method, pattern, examples: [] });
    }
    groups.get(key)!.examples.push(entry);
  }
  return groups;
}

/** Render grouped endpoints as a markdown reference document. */
export function renderMarkdown(
  platform: string,
  groups: Map<string, EndpointGroup>,
): string {
  const lines: string[] = [
    `# ${platform} API Reference`,
    '',
    `> Auto-generated from mitmproxy capture. ${groups.size} unique endpoint patterns.`,
    '',
  ];

  for (const [key, group] of [...groups.entries()].sort()) {
    const ex = group.examples[0];
    lines.push(`## \`${key}\``);
    lines.push('');
    lines.push(`**Captured calls:** ${group.examples.length}`);
    lines.push(`**Status:** ${ex.response_status ?? 'unknown'}`);
    lines.push('');

    if (ex.request_body && ex.request_body !== '<binary>') {
      lines.push('**Request body (first example):**');
      lines.push('```json');
      try {
        lines.push(JSON.stringify(JSON.parse(ex.request_body), null, 2));
      } catch {
        lines.push(ex.request_body.slice(0, 500));
      }
      lines.push('```');
      lines.push('');
    }

    if (ex.response_body && ex.response_body !== '<binary>') {
      lines.push('**Response body (first example):**');
      lines.push('```json');
      try {
        lines.push(
          JSON.stringify(JSON.parse(ex.response_body), null, 2).slice(0, 2000),
        );
      } catch {
        lines.push(ex.response_body.slice(0, 500));
      }
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export async function loadEntries(inputDir: string): Promise<CapturedEntry[]> {
  const files = await readdir(inputDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  const entries = await Promise.all(
    jsonFiles.map(async (f) => {
      const raw = await readFile(join(inputDir, f), 'utf-8');
      return JSON.parse(raw) as CapturedEntry;
    }),
  );
  return entries;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const outputIdx = args.indexOf('--output');

  if (inputIdx === -1 || outputIdx === -1) {
    console.error(
      'Usage: tsx parse_captured.ts --input <dir> --output <file.md>',
    );
    process.exit(1);
  }

  const inputDir = args[inputIdx + 1];
  const outputFile = args[outputIdx + 1];
  const platformGuess =
    inputDir
      .split('/')
      .find((p) => ['ubereats', 'thuisbezorgd'].includes(p)) ?? 'unknown';

  const entries = await loadEntries(inputDir);
  console.log(`Loaded ${entries.length} captured entries`);

  const groups = groupByPattern(entries);
  console.log(`Found ${groups.size} unique endpoint patterns`);

  const markdown = renderMarkdown(platformGuess, groups);
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, markdown, 'utf-8');
  console.log(`Written to ${outputFile}`);
}

// Run as CLI only when executed directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch(console.error);
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd tools/api-capture && pnpm test
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/henkipapp/VSCode/Personal/OrderFood
git add tools/api-capture/
git commit -m "feat: add mitmproxy capture addon and parse_captured parser"
```

---

## Task 8: api-capture README + api-reference Placeholders

**Files:**
- Create: `tools/api-capture/README.md`
- Create: `docs/api-reference/ubereats.md`
- Create: `docs/api-reference/thuisbezorgd.md`

- [ ] **Step 1: Create `tools/api-capture/README.md`**

```markdown
# API Capture Guide

Uses [mitmproxy](https://mitmproxy.org) to intercept HTTPS traffic from the official
Uber Eats and Thuisbezorgd mobile apps. Each request/response is saved as JSON and
then parsed into a human-readable API reference doc.

## Prerequisites

- Python 3.10+
- mitmproxy: `pip install mitmproxy`
- iPhone or Android on the same Wi-Fi as your Mac

## Step 1 — Start mitmproxy

```bash
mitmproxy -s tools/api-capture/capture.py
```

## Step 2 — Install the mitmproxy Certificate on Your Phone

1. Find your Mac's local IP: `ipconfig getifaddr en0`
2. On your phone, set HTTP Proxy in Wi-Fi settings:
   - Server: `<your-mac-ip>`, Port: `8080`
3. In a browser on your phone, open `http://mitm.it`
4. Install the cert for your OS:
   - **iOS:** Settings → General → VPN & Device Management → trust it
   - **Android:** Settings → Security → Install certificate from storage

## Step 3 — Capture Traffic

Open the **Uber Eats** app:
1. Search for restaurants near a real location
2. Open a restaurant and browse the menu
3. Add an item to cart (select options if prompted)
4. Go to checkout — you do NOT need to place an order

Repeat with the **Thuisbezorgd** app.

Captures are saved to `tools/api-capture/output/{platform}/`.

## Step 4 — Generate API Reference Docs

```bash
cd tools/api-capture
pnpm parse:ubereats
pnpm parse:thuisbezorgd
```

## Step 5 — Remove the Proxy

Remove the proxy setting from your phone's Wi-Fi config when done.

## Notes

- `output/` is gitignored — raw captures stay local
- Both contributors should capture independently and compare results
```

- [ ] **Step 2: Create placeholder api-reference docs**

Create `docs/api-reference/ubereats.md`:
```markdown
# Uber Eats API Reference

> **Not yet populated.** Run the capture workflow in `tools/api-capture/README.md`,
> then run `parse_captured.ts` to generate this file.
```

Create `docs/api-reference/thuisbezorgd.md`:
```markdown
# Thuisbezorgd API Reference

> **Not yet populated.** Run the capture workflow in `tools/api-capture/README.md`,
> then run `parse_captured.ts` to generate this file.
```

- [ ] **Step 3: Commit**

```bash
git add tools/api-capture/README.md docs/
git commit -m "docs: add api-capture README and api-reference placeholders"
```

---

## Task 9: Root README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# OrderFood MCP

An MCP server that lets AI agents discover restaurants and place food delivery orders
on **Uber Eats** and **Thuisbezorgd** (Just Eat Takeaway).

> **Status:** Foundation phase — platform API discovery in progress.

## Legal

Reverse engineering for interoperability is explicitly permitted under
EU Directive 2009/24/EC Article 6. This project is personal use + open-source
research/demo, not commercial.

## Repository Structure

\`\`\`
packages/shared            — normalized types (Restaurant, MenuItem, Order, etc.)
packages/ubereats-client   — Uber Eats REST client (Plan 2)
packages/thuisbezorgd-client — Thuisbezorgd REST client (Plan 2)
packages/mcp-server        — MCP server exposing 11 tools (Plan 2)
tools/api-capture          — mitmproxy addon for API discovery
docs/api-reference         — auto-generated endpoint docs (after capture)
docs/superpowers           — specs and implementation plans
\`\`\`

## Getting Started

### 1. Install dependencies

\`\`\`bash
pnpm install
\`\`\`

### 2. Run API capture (one-time, before Plan 2)

See [\`tools/api-capture/README.md\`](tools/api-capture/README.md).

### 3. Build

\`\`\`bash
pnpm build
\`\`\`

### 4. Run tests

\`\`\`bash
pnpm test
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root README"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run all tests from repo root**

```bash
cd /Users/henkipapp/VSCode/Personal/OrderFood && pnpm test
```
Expected: All tests PASS across `packages/shared` and `tools/api-capture`.

- [ ] **Step 2: Typecheck all packages**

```bash
pnpm typecheck
```
Expected: No TypeScript errors.

- [ ] **Step 3: Verify git history**

```bash
git log --oneline
```
Expected:
```
... docs: add root README
... docs: add api-capture README and api-reference placeholders
... feat: add mitmproxy capture addon and parse_captured parser
... feat: add @orderfood/shared types and errors
... chore: bootstrap pnpm workspace
```

- [ ] **Step 4: Verify capture.py syntax** *(requires mitmproxy installed)*

```bash
python3 -m py_compile tools/api-capture/capture.py && echo "capture.py OK"
```
Expected: `capture.py OK`

---

## ⏸ Manual Gate — API Discovery

**Before starting Plan 2, run the mitmproxy capture:**

1. Follow `tools/api-capture/README.md` (both platforms, both you and Dante)
2. Run `parse_captured.ts` to populate `docs/api-reference/`
3. Review the generated docs to identify:
   - Auth endpoints (login, token refresh)
   - Search/discovery endpoints
   - Restaurant/menu endpoints
   - Cart endpoints (add, get, clear)
   - Order placement and tracking endpoints

Once `docs/api-reference/ubereats.md` and `docs/api-reference/thuisbezorgd.md` contain real captured data, start **Plan 2: Platform Clients + MCP Server**.
