# Setup Guide

This guide walks through installing OrderFood, authenticating with each platform, and connecting the MCP server to your AI agent.

---

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **pnpm 9+** — `npm install -g pnpm`
- An active **Uber Eats** and/or **Thuisbezorgd** account

---

## 1. Install

```bash
npm install -g @henkas/orderfood
```

Or use without installing (recommended):

```bash
npx @henkas/orderfood setup --platform ubereats
```

---

## 2. Authenticate

Credentials are stored encrypted at `~/.orderfood/{platform}.json` using AES-256-GCM. Run setup once per platform.

### Uber Eats

Uber Eats uses browser session cookies. The setup CLI asks you to paste them from DevTools.

**Steps:**

1. Open [ubereats.com](https://www.ubereats.com) in Chrome or Firefox and log in
2. Open DevTools (`F12` / `Cmd+Option+I`)
3. Go to **Application** → **Cookies** → `https://www.ubereats.com`
4. Find and copy the values for these cookies:

   | Cookie | What it is |
   |--------|-----------|
   | `jwt-session` | Short-lived session JWT |
   | `uev2.id.session` | Session UUID |
   | `uev2.id.session_v2` | Session UUID v2 |
   | `uev2.ts.session` | Session timestamp |
   | `uev2.ts.session_v2` | Session timestamp v2 |
   | `_ua` | Client identity |
   | `dId` | Device ID |
   | `uev2.id.xp` | Experiment UUID |

5. Run setup and paste the cookies as a JSON object when prompted:

```bash
npx @henkas/orderfood setup --platform ubereats
```

```
OrderFood Setup — ubereats

Paste the cookies JSON and press Enter:
{"jwt-session": "eyJ...", "uev2.id.session": "...", ...}

✓ Credentials saved to ~/.orderfood/ubereats.json
```

> **Tip:** The session typically lasts 24–48 hours. Re-run setup when you get authentication errors.

---

### Thuisbezorgd

Thuisbezorgd uses OAuth 2.0 PKCE with email/OTP (passwordless). The setup CLI handles the full flow.

```bash
npx @henkas/orderfood setup --platform thuisbezorgd
```

You will be prompted for your email address. A one-time code is sent to your inbox — paste it back into the terminal. The access token and refresh token are saved automatically and refreshed as needed.

---

## 3. Connect to your AI agent

### Claude Code

```bash
claude mcp add orderfood -- npx @henkas/orderfood
```

### Codex

```bash
codex mcp add orderfood -- npx @henkas/orderfood
```

Restart your agent session after adding the server.

---

## 4. Verify

Ask your agent:

```
Search for pizza restaurants near Amsterdam Centraal on Thuisbezorgd
```

If the server is connected correctly you'll get a list of restaurants back. If you get an error, check [Troubleshooting](#troubleshooting) below.

---

## Troubleshooting

**`AUTH_MISSING` — credentials not found**
Run `npx @henkas/orderfood setup --platform <platform>` and follow the steps above.

**`AUTH_EXPIRED` — session expired**
Uber Eats sessions expire after 24–48 hours. Re-run setup and paste fresh cookies from your browser.

**`RATE_LIMIT` — too many requests**
Wait the number of seconds indicated in the error before trying again. Avoid running rapid repeated searches.

**MCP server not found by agent**
Make sure you ran `claude mcp add` / `codex mcp add` and fully restarted the agent session. Verify with `claude mcp list` or `codex mcp list`.

**`place_order` not working**
Order placement requires completing a browser-based payment step (Apple Pay or iDeal) that can't currently be automated. See [Platform Support](../README.md#platform-support) for current status.

---

## Credential storage

Credentials are stored at `~/.orderfood/{platform}.json`, encrypted with AES-256-GCM. The encryption key is derived from your machine ID using HKDF-SHA256 — credentials are tied to the machine they were set up on and cannot be transferred.

To remove credentials for a platform:

```bash
rm ~/.orderfood/ubereats.json
rm ~/.orderfood/thuisbezorgd.json
```
