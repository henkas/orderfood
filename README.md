# OrderFood MCP

An MCP server that lets AI agents discover restaurants and place food delivery orders
on **Uber Eats** and **Thuisbezorgd** (Just Eat Takeaway).

> **Status:** Foundation phase — platform API discovery in progress.

## Legal

Reverse engineering for interoperability is explicitly permitted under
EU Directive 2009/24/EC Article 6. This project is personal use + open-source
research/demo, not commercial.

## Repository Structure

```
packages/shared            — normalized types (Restaurant, MenuItem, Order, etc.)
packages/ubereats-client   — Uber Eats REST client (Plan 2)
packages/thuisbezorgd-client — Thuisbezorgd REST client (Plan 2)
packages/mcp-server        — MCP server exposing 11 tools (Plan 2)
tools/api-capture          — mitmproxy addon for API discovery
docs/api-reference         — auto-generated endpoint docs (after capture)
docs/superpowers           — specs and implementation plans
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run API capture (one-time, before Plan 2)

See [`tools/api-capture/README.md`](tools/api-capture/README.md).

### 3. Build

```bash
pnpm build
```

### 4. Run tests

```bash
pnpm test
```
