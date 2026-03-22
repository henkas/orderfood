# Thuisbezorgd API Reference

> **Partial capture — Phase 1.** Auth flow + page structure confirmed. BFF
> restaurant/menu/cart/order endpoints still need capture (see TODO at bottom).
> Run `pnpm parse:thuisbezorgd` after Phase 2 capture to append BFF endpoints.

---

## Overview

Thuisbezorgd (NL brand of Just Eat Takeaway) uses:

| Concern | Domain | Notes |
|---------|--------|-------|
| Consumer web (SSR) | `www.thuisbezorgd.nl` | Next.js; data loaded via BFF |
| Auth | `auth.thuisbezorgd.nl` | Routes to `auth.jet-external.com` |
| BFF (all API calls) | `https://cw-api.takeaway.com` | REST JSON, Bearer token, version `34` |
| Payment page | `pay.thuisbezorgd.nl` | Redirect-based card entry UI |
| JetPay API | `https://consumer.takeawaypay.com/pay/api/v1` | Card/payment method management |

**Authentication:** OAuth 2.0 Authorization Code + PKCE, passwordless (email OTP).
**Bearer token:** sent as `Authorization: Bearer {access_token}` on all BFF calls.
**Token TTL:** 3600 s (1 hour). Refresh via `refresh_token`.

---

## Auth Flow

### 1. Start PKCE handshake

```
GET https://auth.thuisbezorgd.nl/connect/authorize
  ?client_id=consumer_web_je
  &redirect_uri=https://www.thuisbezorgd.nl/en/signin-oidc?returnUrl=...
  &response_type=code
  &scope=openid+profile+mobile_scope+offline_access
  &state={random_hex_32}
  &code_challenge={base64url(SHA256(code_verifier))}
  &code_challenge_method=S256
  &ui_locales=en
  &acr_values=tenant:nl+auser:{user_uuid_if_known}
```

Client generates:
- `code_verifier`: random 43–128 char URL-safe string
- `code_challenge`: `BASE64URL(SHA256(code_verifier))`
- `state`: random hex

### 2. Validate email

```
POST https://auth.thuisbezorgd.nl/applications/authenticationservice/credentials/email/validate
Content-Type: application/json

{
  "email": "user@example.com",
  "returnUrl": "/connect/authorize/callback?client_id=consumer_web_je&..."
}
```

**Response:**
```json
{
  "target": "user@example.com",
  "validatedReturnUrl": "/connect/authorize/callback?..."
}
```

### 3. Validate OTP

6-character alphanumeric OTP sent to email.

```
POST https://auth.thuisbezorgd.nl/applications/authenticationservice/credentials/otp/validate
Content-Type: application/json

{
  "otp": "32SKXS",
  "returnUrl": "/connect/authorize/callback?client_id=consumer_web_je&..."
}
```

**Response:**
```json
{
  "validatedReturnUrl": "/connect/authorize/callback?..."
}
```

Server then performs redirect chain → `returnUrl` contains auth `code`.

### 4. Exchange code for tokens

```
POST https://auth.thuisbezorgd.nl/connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&redirect_uri=https://www.thuisbezorgd.nl/en/signin-oidc?returnUrl=...
&code={auth_code_from_callback}
&code_verifier={original_code_verifier}
&client_id=consumer_web_je
```

**Response:**
```json
{
  "id_token": "eyJ...",
  "access_token": "eyJ...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "refresh_token": "...",
  "scope": "openid profile mobile_scope offline_access"
}
```

**Access token claims (relevant):**
```json
{
  "iss": "https://auth.jet-external.com",
  "sub": "3811644",
  "email": "user@example.com",
  "given_name": "First",
  "family_name": "Last",
  "tenant": ["nl"],
  "tkwy_legacy_id": "13224503576",
  "exp": 1774217463
}
```

### 5. Refresh token

```
POST https://auth.thuisbezorgd.nl/connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id=consumer_web_je
```

---

## Credential storage

Store in `~/.orderfood/thuisbezorgd.json` (AES-256-GCM):

```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_at": 1774217463,
  "user_id": "3811644"
}
```

---

## BFF API — base URL and headers

```
Base URL: https://cw-api.takeaway.com
Version:  34 (passed as path prefix or header — to be confirmed in Phase 2 capture)

Headers:
  Authorization: Bearer {access_token}
  Content-Type: application/json
  Accept-Language: nl
```

> **⚠️ Phase 2 TODO:** All endpoints below are inferred from UI behaviour and
> need to be confirmed with actual captures. Run the updated capture.py
> (now including `takeaway.com`) and browse: restaurant list, menu page,
> add item to basket, checkout.

---

## BFF Endpoints (to be confirmed in Phase 2)

### Restaurant search / listing

Inferred from URL: `GET /en/delivery/food/rijswijk-2285`

```
GET https://cw-api.takeaway.com/...   (exact path TBD)
```

### Restaurant menu

Inferred from URL: `/en/menu/thunderbuns-smashburgers-rijswijk`

```
GET https://cw-api.takeaway.com/.../{slug}/menu   (exact path TBD)
```

### Basket management

Basket IDs follow the format: `{base64url(uuid)}-v1`
e.g. `MzRlYjZhMWItOWNmYS00OD...-v1` decodes to UUID prefix `34eb6a1b-9cfa-48...`

Order IDs are nanoid format, e.g. `rvrhuugcleez2nxzm5ztza`.

```
POST https://cw-api.takeaway.com/...   (create basket — TBD)
GET  https://cw-api.takeaway.com/...   (get basket — TBD)
PUT  https://cw-api.takeaway.com/...   (update basket — TBD)
POST https://cw-api.takeaway.com/...   (place order — TBD)
GET  https://cw-api.takeaway.com/...   (track order — TBD)
```

### Payment methods (JetPay)

```
GET https://consumer.takeawaypay.com/pay/api/v1/...
  Authorization: Bearer {access_token}
```

---

## Known cookies (web session)

| Cookie | Purpose |
|--------|---------|
| `je-auser` | Anonymous user UUID (pre-login tracking) |
| `jet-sp-customer-id.02b0` | Authenticated customer session |
| `cf_clearance` | Cloudflare challenge clearance |

---

## TODO — Phase 2 capture checklist

Run mitmproxy with updated `capture.py` (now captures `takeaway.com` and `takeawaypay.com`):

- [ ] Browse restaurant list → capture BFF restaurant listing endpoint
- [ ] Open restaurant menu → capture BFF menu endpoint + item detail endpoint
- [ ] Add item to basket → capture basket create + update endpoints
- [ ] Open checkout → capture checkout/order summary endpoint
- [ ] View payment methods → capture JetPay payment profiles endpoint
