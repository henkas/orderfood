# OrderFood MCP

[![CI](https://github.com/henkas/orderfood/actions/workflows/ci.yml/badge.svg)](https://github.com/henkas/orderfood/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@henkas/orderfood)](https://www.npmjs.com/package/@henkas/orderfood)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MCP server that lets AI agents search restaurants and place food delivery orders on **Uber Eats** and **Thuisbezorgd** via 11 MCP tools.

> **Legal:** Reverse engineering for interoperability is explicitly permitted under EU Directive 2009/24/EC Article 6. This project is personal use and open-source research — not commercial, not affiliated with Uber Eats or Just Eat Takeaway.

---

## Who this is for

- **AI power users** who want to tell Claude or Codex "find me sushi nearby and add the best-rated option to my cart" and have it actually work
- **Developers** exploring MCP server design for real-world consumer API integrations
- **Researchers** studying reverse-engineered API interoperability under EU Directive 2009/24/EC Article 6

## Who this is not for

- Anyone looking for a fully automated "place order without touching anything" experience — order placement requires a browser payment step on both platforms and is not yet automatable (see Platform Support below)
- High-volume or commercial use — this tool is designed for personal, single-account use only
- Users who need a rock-solid session — Uber Eats cookies expire in 24–48 hours and require manual refresh; Thuisbezorgd tokens auto-refresh but the APIs can change without notice

## Features

| Tool | Description |
|------|-------------|
| `search_restaurants` | Find restaurants by location, cuisine, or query |
| `get_restaurant` | Get full restaurant details and menu |
| `get_cart` | View current cart |
| `add_to_cart` | Add an item to the cart with options |
| `clear_cart` | Empty the cart |
| `get_saved_addresses` | List saved delivery addresses |
| `get_payment_methods` | List available payment methods |
| `place_order` | Place the current cart as an order |
| `track_order` | Get live order status |
| `get_order_history` | List past orders |
| `cancel_order` | Cancel an active order |

All tools accept `platform: "ubereats" | "thuisbezorgd"` as a required parameter.

## Platform Support

| Capability | Uber Eats | Thuisbezorgd | Notes |
|---|---|---|---|
| Search restaurants | ✅ | ✅ | |
| Get restaurant + menu | ✅ | ✅ | TB uses SSR HTML scraping |
| Cart management | ✅ | ✅ | |
| Saved addresses | — | ✅ | UE resolves addresses on-the-fly |
| Payment methods | ✅ | ✅ | |
| Place order | ⚠️ | ⚠️ | Blocked by browser payment flow (Apple Pay / iDeal / Adyen) |
| Track order | ✅ | 🚧 | TB tracking endpoint not yet captured |
| Order history | 🚧 | 🚧 | Endpoint captured but request body not confirmed |
| Cancel order | 🚧 | 🚧 | Endpoint not yet captured |
| Health check | ✅ | ✅ | `ping_platform` tool verifies auth + connectivity |

**Legend:** ✅ working · ⚠️ blocked by external dependency · 🚧 stub (API not yet captured) · — not applicable

## Architecture

pnpm workspace monorepo — TypeScript 5, strict, pure ESM, Node.js 20+.

```
packages/
  shared/               @orderfood/shared — normalized types + PlatformClient interface
  ubereats-client/      @orderfood/ubereats-client — Uber Eats REST client
  thuisbezorgd-client/  @orderfood/thuisbezorgd-client — Thuisbezorgd REST client
  mcp-server/           @henkas/orderfood — MCP server + setup CLI
tools/
  api-capture/          mitmproxy addon for capturing API traffic
docs/
  api-reference/        Documented endpoints per platform
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+ *(only for API capture tooling)*

## Installation

```bash
git clone https://github.com/henkas/orderfood.git
cd orderfood
pnpm install
pnpm build
```

## Setup

```bash
npx @henkas/orderfood setup --platform ubereats
npx @henkas/orderfood setup --platform thuisbezorgd
```

Credentials are stored encrypted at `~/.orderfood/` (AES-256-GCM). See the [Setup Guide](docs/setup.md) for full step-by-step instructions including where to find the Uber Eats cookies and how the Thuisbezorgd OAuth flow works.

## Usage with Claude Code

```bash
claude mcp add orderfood -- npx @henkas/orderfood
```

Or if running from source:

```bash
claude mcp add orderfood -- node /path/to/orderfood/packages/mcp-server/dist/index.js
```

## Usage with Codex

```bash
codex mcp add orderfood -- npx @henkas/orderfood
```

Then talk to Claude:

```
Find Italian restaurants near Amsterdam Centraal on Thuisbezorgd
```
```
Add a Margherita pizza from [restaurant] to my Uber Eats cart
```
```
What's in my Thuisbezorgd cart?
```
```
Show my Uber Eats payment methods
```

## Development

```bash
pnpm install        # install all workspace packages
pnpm typecheck      # type-check all packages
pnpm test           # run all tests
pnpm build          # compile all packages

# Per-package
pnpm --filter @orderfood/shared test
pnpm --filter @henkas/orderfood build
```

## API Capture

Platform client code is based on mitmproxy captures of the real apps. To contribute new endpoint discoveries:

1. `pip install mitmproxy`
2. Follow `tools/api-capture/README.md` to install the cert on your device
3. `mitmproxy -s tools/api-capture/capture.py`
4. Use the app — captured calls land in `tools/api-capture/output/{platform}/`
5. Document findings in `docs/api-reference/{platform}.md`

## Documentation

| | |
|---|---|
| [Setup Guide](docs/setup.md) | Install, authenticate, connect to your agent |
| [Uber Eats API Reference](docs/api-reference/ubereats.md) | Discovered endpoints and request shapes |
| [Thuisbezorgd API Reference](docs/api-reference/thuisbezorgd.md) | Discovered endpoints and request shapes |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Credentials are encrypted at rest (AES-256-GCM, HKDF-SHA256 key from machine ID). See [SECURITY.md](SECURITY.md) for the vulnerability reporting process.

## License

MIT — see [LICENSE](LICENSE).
