# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP server that lets AI agents place food delivery orders on **Uber Eats** and **Thuisbezorgd** via reverse-engineered APIs. Legal basis: EU Directive 2009/24/EC Article 6 (interoperability reverse engineering). Personal use + open-source research, not commercial.

**Status:** Foundation phase (Plan 1) — platform API discovery in progress. Platform clients and MCP server come in Plan 2 after mitmproxy capture is complete.

Spec: `docs/superpowers/specs/2026-03-22-orderfood-mcp-design.md`
Plans: `docs/superpowers/plans/`

## Commands

```bash
pnpm install          # install all workspace packages
pnpm build            # compile all packages (tsc)
pnpm test             # run all tests across workspace
pnpm typecheck        # type-check without emitting

# Per-package (from repo root)
pnpm --filter @orderfood/shared test
pnpm --filter @orderfood/shared build

# API capture (after mitmproxy capture run)
cd tools/api-capture
pnpm parse:ubereats        # → docs/api-reference/ubereats.md
pnpm parse:thuisbezorgd    # → docs/api-reference/thuisbezorgd.md

# Run a single test file
pnpm --filter @orderfood/shared exec vitest run tests/errors.test.ts
```

## Architecture

**pnpm workspace monorepo.** TypeScript 5, strict mode, pure ESM (`"type": "module"`), NodeNext module resolution. All packages extend `tsconfig.base.json`.

```
packages/shared            — @orderfood/shared: normalized cross-platform types + errors
packages/ubereats-client   — @orderfood/ubereats-client: UE REST client (Plan 2)
packages/thuisbezorgd-client — @orderfood/thuisbezorgd-client: TB REST client (Plan 2)
packages/mcp-server        — @orderfood/mcp-server: MCP server with 11 tools (Plan 2)
tools/api-capture          — mitmproxy addon (Python) + JSON parser (TypeScript)
docs/api-reference/        — auto-generated endpoint docs from mitmproxy capture
```

### Key design decisions

**`@orderfood/shared` is the lingua franca.** All platform clients map their raw API responses into shared types (`Restaurant`, `MenuItem`, `Cart`, `Order`, etc.) via `mappers.ts`. MCP tools never see platform-specific JSON shapes.

**`PlatformClient` interface** (`packages/shared/src/types.ts`) is the contract both platform clients implement. When adding a new platform, implement this interface — no MCP tool changes required.

**Monetary values are integers (cents)** throughout. Never floats.

**Carts are server-side** — `getCart()` and `addToCart()` call the platform's actual cart API. No local cart state in the MCP server.

**Credentials** stored encrypted at `~/.orderfood/{platform}.json`. AES-256-GCM, key derived via HKDF-SHA256 from machine ID. Token refresh is automatic (pre-emptive at 60s before expiry); rate limit errors surface immediately without retry.

### Error hierarchy (`packages/shared/src/errors.ts`)

```
PlatformError (base)
  ├── AuthError        — credentials invalid/expired; re-run setup
  ├── NotFoundError    — restaurant/item/order not found
  ├── ValidationError  — e.g. unsatisfied required option group
  └── RateLimitError   — has .retry_after (seconds); caller decides whether to wait
```

All MCP tools catch these and return `{ error: string, code: string }` so agents understand failures.

### MCP tools (Plan 2)

11 tools, all require `platform: "ubereats" | "thuisbezorgd"`:
`search_restaurants`, `get_restaurant`, `get_cart`, `add_to_cart`, `clear_cart`, `get_saved_addresses`, `get_payment_methods`, `place_order`, `track_order`, `get_order_history`, `cancel_order`

### API capture workflow (Phase 1 gate)

Platform client code must not be written until `docs/api-reference/ubereats.md` and `docs/api-reference/thuisbezorgd.md` contain real captured data. See `tools/api-capture/README.md` for the mitmproxy setup walkthrough.
