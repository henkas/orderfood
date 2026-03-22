# @henkas/orderfood

[![CI](https://github.com/henkas/orderfood/actions/workflows/ci.yml/badge.svg)](https://github.com/henkas/orderfood/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/henkas/orderfood/blob/main/LICENSE)

MCP server that lets AI agents search restaurants and place food delivery orders on **Uber Eats** and **Thuisbezorgd** via 11 MCP tools.

> **Legal:** Reverse engineering for interoperability is explicitly permitted under EU Directive 2009/24/EC Article 6. Personal use and open-source research — not commercial, not affiliated with Uber Eats or Just Eat Takeaway.

## Setup

```bash
npx @henkas/orderfood setup --platform ubereats
npx @henkas/orderfood setup --platform thuisbezorgd
```

Credentials are stored encrypted at `~/.orderfood/` (AES-256-GCM).

## Usage with Claude Code

```bash
claude mcp add orderfood -- npx @henkas/orderfood
```

## Usage with Codex

```bash
codex mcp add orderfood -- npx @henkas/orderfood
```

Then talk to your agent:

```
Find Italian restaurants near Amsterdam Centraal on Thuisbezorgd
Add a Margherita pizza from [restaurant] to my Uber Eats cart
What's in my Thuisbezorgd cart?
Show my Uber Eats payment methods
```

## Tools

| Tool | Description |
|------|-------------|
| `search_restaurants` | Find restaurants by location, cuisine, or query |
| `get_restaurant` | Get full restaurant details and menu |
| `get_cart` | View current cart |
| `add_to_cart` | Add an item with options |
| `clear_cart` | Empty the cart |
| `get_saved_addresses` | List saved delivery addresses |
| `get_payment_methods` | List payment methods |
| `place_order` | Place the current cart as an order |
| `track_order` | Get live order status |
| `get_order_history` | List past orders |
| `cancel_order` | Cancel an active order |

All tools accept `platform: "ubereats" | "thuisbezorgd"`.

## Platform support

| Capability | Uber Eats | Thuisbezorgd |
|---|---|---|
| Search restaurants | ✅ | ✅ |
| Get restaurant + menu | ✅ | ✅ |
| Cart management | ✅ | ✅ |
| Saved addresses | — | ✅ |
| Payment methods | ✅ | ✅ |
| Place order | ⚠️ | ⚠️ |
| Track order | ✅ | 🚧 |
| Order history | 🚧 | 🚧 |
| Cancel order | 🚧 | 🚧 |

⚠️ = blocked by browser-based payment flow &nbsp; 🚧 = stub, coming soon

## Requirements

Node.js 20+

## Full docs

[github.com/henkas/orderfood](https://github.com/henkas/orderfood)
