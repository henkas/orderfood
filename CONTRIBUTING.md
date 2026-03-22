# Contributing to OrderFood MCP

Thank you for your interest in contributing. This document explains how to get started, the development workflow, and the conventions this project follows.

---

## Getting started

**Prerequisites:** Node.js 20+, pnpm 9+, Python 3.11+ (for capture tooling).

```bash
git clone https://github.com/<!-- your-github-username -->/orderfood.git
cd orderfood
pnpm install
pnpm build
```

Verify everything is working:

```bash
pnpm test
pnpm typecheck
```

---

## Development workflow

All commands are run from the repository root unless noted otherwise.

```bash
pnpm build          # compile all packages (tsc)
pnpm test           # run all tests across the workspace
pnpm typecheck      # type-check without emitting output

# Per-package commands
pnpm --filter @orderfood/shared build
pnpm --filter @orderfood/shared test

# Run a single test file
pnpm --filter @orderfood/shared exec vitest run tests/errors.test.ts
```

Each package compiles independently. After editing source in one package, rebuild only that package with `pnpm --filter <package-name> build`.

---

## Adding a new platform

All platform clients implement the `PlatformClient` interface defined in `packages/shared/src/types.ts`. Adding a new platform requires no changes to the MCP server tools.

1. **Run API capture** for the new platform (see [API capture workflow](#api-capture-workflow) below).
2. **Create a new package** under `packages/<platform>-client/` following the structure of `packages/ubereats-client/`:
   - `src/types.ts` — platform-specific raw API response shapes
   - `src/auth.ts` — token management and refresh logic
   - `src/mappers.ts` — transform raw responses into `@orderfood/shared` types
   - `src/client.ts` — implements `PlatformClient`
3. **Wire it into the MCP server** in `packages/mcp-server/src/config.ts`.
4. **Add the platform name** to the `Platform` union type in `packages/shared/src/types.ts`.
5. Write tests for your mappers. Unit tests are preferred over integration tests where possible.

---

## API capture workflow

Platform client code must not be written until the corresponding endpoint reference document (`docs/api-reference/<platform>.md`) contains real captured data from a live session.

```bash
# 1. Install mitmproxy
pip install mitmproxy

# 2. Run the capture addon
mitmproxy -s tools/api-capture/capture.py

# 3. Configure your mobile device to proxy through mitmproxy
#    - Install the mitmproxy CA cert: visit http://mitm.it on the device while proxied
#    - Set device proxy to <your-machine-ip>:8080

# 4. Use the target app: search restaurants, browse menus, add to cart, place an order
#    Captured JSON is written to tools/api-capture/output/{platform}/

# 5. Parse the captured data into an endpoint reference doc
cd tools/api-capture
pnpm parse:ubereats        # → docs/api-reference/ubereats.md
pnpm parse:thuisbezorgd    # → docs/api-reference/thuisbezorgd.md
```

See `tools/api-capture/README.md` for the complete iOS/Android proxy setup walkthrough.

When submitting captured endpoint data, include:
- The generated `docs/api-reference/<platform>.md` file
- A brief summary of which flows you captured (search, menu, cart, checkout, etc.)

Do **not** commit raw capture files (they may contain personal tokens and order data).

---

## Code style

- **TypeScript strict mode** — no `any`, no implicit returns, no unused variables. All packages extend `tsconfig.base.json`.
- **Pure ESM** — `"type": "module"` is set at the workspace root. Use `.js` extensions in import paths (NodeNext resolution).
- **Monetary values are integers (cents)** — never use floats for prices, fees, or totals. `1099` means €10.99.
- **No local cart state** — carts live on the platform servers. Never cache cart data in memory between requests.
- **Error handling** — throw the appropriate subclass from `packages/shared/src/errors.ts` (`AuthError`, `NotFoundError`, `ValidationError`, `RateLimitError`). MCP tools catch these and return structured `{ error, code }` responses.
- **No magic numbers** — use named constants for timeouts, limits, and retry windows.

---

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(mcp-server): add cancel_order tool
fix(ubereats-client): handle 429 response without retry-after header
docs: update API capture walkthrough for iOS 17
refactor(shared): rename CartItemOption to SelectedOption
test(thuisbezorgd-client): add mapper tests for restaurant search
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

Use the package name as the scope when the change is scoped to one package.

---

## Pull request checklist

Before opening a PR, confirm the following:

- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New code has corresponding tests (unit tests for mappers; integration tests where practical)
- [ ] No raw capture files, tokens, or credentials are included
- [ ] Monetary values use cents (integers), not floats
- [ ] Commit messages follow Conventional Commits format
- [ ] `docs/api-reference/` is updated if new endpoints were discovered
- [ ] PR description explains the motivation and links to any related issues
