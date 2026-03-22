# API Capture Guide

Uses [mitmproxy](https://mitmproxy.org) to intercept HTTPS traffic from the official
Uber Eats and Thuisbezorgd mobile apps. Each request/response is saved as JSON and
then parsed into a human-readable API reference doc.

## Prerequisites

- Python 3.10+
- iPhone or Android on the same Wi-Fi as your Mac

## Step 1 — Start mitmproxy

```bash
cd tools/api-capture
python3 -m venv .venv
.venv/bin/pip install mitmproxy
tools/api-capture/.venv/bin/mitmproxy -s tools/api-capture/capture.py
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
