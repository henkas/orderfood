# Thuisbezorgd API Reference

> **Phase 1 + Phase 2 capture complete** — auth, restaurant listing, and menu
> fully confirmed. BFF token exchange + basket/order endpoints still need one
> more targeted capture (see TODO). All confirmed data marked ✓.

---

## Overview

| Concern | Domain | Auth needed |
|---------|--------|-------------|
| Restaurant listing | `www.thuisbezorgd.nl/en/delivery/food/{city}-{postcode}` | No (public SSR) |
| Restaurant menu | `www.thuisbezorgd.nl/en/menu/{slug}` | No (public SSR) |
| Auth | `auth.thuisbezorgd.nl` | — |
| BFF (cart, orders, account) | `https://cw-api.takeaway.com/api/v34/` | Yes — BFF JWT |
| JetPay | `https://consumer.takeawaypay.com/pay/api/v1` | Yes — BFF JWT |

**Two data retrieval strategies (confirmed):**
- Public pages (restaurants, menu): `GET` the SSR Next.js page, parse embedded state JSON
- Interactive operations (cart, orders): `GET/POST` BFF endpoints with `Authorization: Bearer {bff_jwt}`

**Price encoding (⚠️ inconsistent across sources):**
- `deliveryFees.*.fee` in restaurant listing: **integer cents** (`299` = €2.99) ✓
- `basePrice` / `additionPrice` in menu CDN data: **float euros** (`12.45` = €12.45) ✓
- All values in shared types must be converted to integer cents

---

## Auth Flow ✓

### 1–4. PKCE + email OTP → access_token

```
GET  https://auth.thuisbezorgd.nl/connect/authorize
       ?client_id=consumer_web_je
       &response_type=code
       &scope=openid+profile+mobile_scope+offline_access
       &code_challenge={BASE64URL(SHA256(verifier))}
       &code_challenge_method=S256
       &state={random_hex}
       &ui_locales=en
       &acr_values=tenant:nl

POST https://auth.thuisbezorgd.nl/applications/authenticationservice/credentials/email/validate
     {"email":"user@example.com","returnUrl":"/connect/authorize/callback?..."}
     → {"target":"user@example.com","validatedReturnUrl":"..."}

POST https://auth.thuisbezorgd.nl/applications/authenticationservice/credentials/otp/validate
     {"otp":"32SKXS","returnUrl":"/connect/authorize/callback?..."}
     → {"validatedReturnUrl":"..."}
     (server redirects to callback with ?code=...)

POST https://auth.thuisbezorgd.nl/connect/token
     Content-Type: application/x-www-form-urlencoded
     grant_type=authorization_code&code={code}&code_verifier={verifier}
     &redirect_uri=https://www.thuisbezorgd.nl/en/signin-oidc?returnUrl=...
     &client_id=consumer_web_je
     → {access_token, refresh_token, expires_in:3600, id_token, token_type:"Bearer"}
```

### 5. Token refresh

```
POST https://auth.thuisbezorgd.nl/connect/token
     grant_type=refresh_token&refresh_token={rt}&client_id=consumer_web_je
```

### 6. BFF token exchange ⚠️ (not yet captured — TODO)

The BFF uses a **different JWT** than the PKCE `access_token`. Observed BFF token has:
- `aud: "consumer-systems"`, `client_id: "graphQl"`, `country_code: "NL"`
- Contains `legacy_token` and `customer_id` (= `tkwy_enc_legacy_id` from PKCE claims)

Likely endpoint (unconfirmed):
```
POST https://cw-api.takeaway.com/api/v34/auth (or similar)
     Authorization: Bearer {pkce_access_token}
     → {bff_jwt}
```

### Credential storage

```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "bff_token": "eyJ...",
  "bff_expires_at": 1774216721,
  "expires_at": 1774217463,
  "user_id": "3811644"
}
```

---

## Restaurant Listing ✓

### Endpoint

```
GET https://www.thuisbezorgd.nl/en/delivery/food/{city}-{postcode}?openOnWeb=true
```

No auth required. Response is an SSR HTML page with data embedded in a JS state blob.

### Data location

The full restaurant data is in the inline JavaScript (NOT `__NEXT_DATA__` pageProps).
Look for: `"restaurantList":{"filteredRestaurantIds":[...]` and `"restaurants":{"lists":{...`

### Restaurant object ✓

```json
{
  "id": "10385916",
  "name": "Thunderbuns | Smash Burgers | Rijswijk",
  "uniqueName": "thunderbuns-smashburgers-rijswijk",
  "brandName": "Thunderbuns",
  "address": {
    "city": "Rijswijk",
    "firstLine": "Dr. Colijnlaan 323",
    "postalCode": "2283XL",
    "location": {"type": "Point", "coordinates": [4.321394, 52.04085]}
  },
  "rating": {"count": 203, "starRating": 4},
  "isNew": false,
  "isOpenNowForDelivery": true,
  "isOpenNowForCollection": false,
  "deliveryEtaMinutes": {"rangeLower": 35, "rangeUpper": 50},
  "deliveryFees": {
    "byMinFee": {"minimumAmount": 1000, "fee": 299},
    "byMaxFee": {"minimumAmount": 1000, "fee": 299},
    "numBands": 1
  },
  "cuisines": [
    {"name": "Burgers", "uniqueName": "burger"},
    {"name": "100% Halal", "uniqueName": "100-percent-halal"}
  ],
  "logoUrl": "https://res.cloudinary.com/tkwy-prod-eu/image/upload/.../logo_465x320.png",
  "deals": [{"description": "2-for-1", "offerType": "Bogof"}]
}
```

**Note:** `deliveryFees.*.fee` and `minimumAmount` are integer **cents**.
**Note:** `restaurantList.filteredRestaurantIds` gives the ordered list. The full restaurant objects are in a separate map keyed by numeric ID string.

---

## Restaurant Menu ✓

### Endpoint

```
GET https://www.thuisbezorgd.nl/en/menu/{restaurant-slug}
```

No auth required. Response is SSR HTML. Menu data is embedded deep in the JS state,
NOT in `__NEXT_DATA__` pageProps (those only have caching headers).

### Data location

Search the HTML for: `"cdn":{"restaurant":{"httpStatusCode":200`

### restaurantInfo ✓

```json
{
  "restaurantId": "10385916",
  "restaurantInfo": {
    "name": "Thunderbuns | Smash Burgers | Rijswijk",
    "seoName": "thunderbuns-smashburgers-rijswijk",
    "description": "",
    "logoUrl": "https://res.cloudinary.com/...",
    "bannerUrl": "https://res.cloudinary.com/...",
    "location": {
      "address": "Dr. Colijnlaan 323",
      "postCode": "2283XL",
      "city": "Rijswijk",
      "latitude": 52.04085,
      "longitude": 4.321394
    },
    "cuisineTypes": [
      {"id": "78", "name": "Burgers", "seoName": "burger", "language": "en"}
    ],
    "restaurantOpeningTimes": [
      {
        "serviceType": "delivery",
        "timesPerDay": [
          {"dayOfWeek": "Sunday", "times": [{"fromLocalTime": "15:00", "toLocalTime": "22:45"}]}
        ]
      }
    ]
  }
}
```

### menus[0].categories ✓

```json
[
  {
    "id": "9f41b014-dde5-47f4-b812-7776043def69",
    "name": "Burgers",
    "description": "",
    "preview": "The Classic Bun, The Truffle Parmesan Bun, ...",
    "itemIds": ["6fbdf238-...", "9e1db55d-...", "01a27631-...", "f22a4038-..."],
    "parentIds": [],
    "imageSources": [{"path": "https://just-eat-prod-eu-res.cloudinary.com/...", "source": "Cloudinaryv2"}]
  }
]
```

### items (dict keyed by UUID) ✓

```json
{
  "9e1db55d-f534-4fe3-b756-54638b54d361": {
    "id": "9e1db55d-f534-4fe3-b756-54638b54d361",
    "name": "The Classic Bun",
    "description": "Our classic smash burger...",
    "type": "menuitem",
    "imageSources": [{"path": "https://just-eat-prod-eu-res.cloudinary.com/...", "source": "Cloudinaryv2"}],
    "variations": [
      {
        "id": "9e1db55d-f534-4fe3-b756-54638b54d361",
        "name": "The Classic Bun",
        "type": "NoVariation",
        "basePrice": 12.45,
        "dealOnly": false,
        "menuGroupIds": ["3D5284195046B43DA09CD41188AA546B"],
        "modifierGroupsIds": ["55c376bb-7757-4f97-9378-4652ce2583a9", "fa5c416d-1ecf-4283-a01a-9c447ff9faf6"]
      }
    ],
    "hasVariablePrice": false
  }
}
```

**⚠️ `basePrice` is float euros — multiply × 100 and round to get cents.**

### modifierGroups ✓

```json
[
  {
    "id": "55c376bb-7757-4f97-9378-4652ce2583a9",
    "name": "With calf bacon?",
    "minChoices": 0,
    "maxChoices": 1,
    "modifiers": ["6"]
  },
  {
    "id": "fa5c416d-1ecf-4283-a01a-9c447ff9faf6",
    "name": "Extras",
    "minChoices": 0,
    "maxChoices": 1,
    "modifiers": ["7"]
  }
]
```

`modifiers` is an array of string IDs that reference `modifierSets`.

### modifierSets ✓

```json
[
  {
    "id": "6",
    "modifier": {
      "id": "6bd56fb7-eee4-4e17-9057-49e2462363b7",
      "name": "With calf bacon",
      "additionPrice": 2.5,
      "removePrice": 0,
      "defaultChoices": 0,
      "minChoices": 0,
      "maxChoices": 1
    }
  },
  {
    "id": "7",
    "modifier": {
      "id": "ce1d02e6-7ff1-45af-9ad9-e3d3fa75f71f",
      "name": "Extra patty",
      "additionPrice": 3,
      "removePrice": 0,
      "defaultChoices": 0,
      "minChoices": 0,
      "maxChoices": 1
    }
  }
]
```

**⚠️ `additionPrice` is float euros — multiply × 100 and round to get cents.**

---

## BFF API ✓ (partial)

```
Base URL: https://cw-api.takeaway.com/api/v34
Headers:
  Authorization: Bearer {bff_jwt}
  Accept: application/json, text/plain, */*
  X-Requested-With: XMLHttpRequest
  Origin: https://www.thuisbezorgd.nl
```

### Confirmed endpoints ✓

```
GET /user/stamp_cards
→ {stampCards: [{stamps, voucher, restaurant: {id, logoUrl, name, slug}}], enabled}
```

Restaurant `id` here is alphanumeric (`RR5O1Q03`) — different from the numeric ID in SSR pages.

### Basket / order endpoints ⚠️ (path patterns inferred — not yet captured)

Confirmed from checkout URL: `basket=MzRlYjZhMWItOWNmYS00OD...-v1` (base64url UUID + `-v1`)
Confirmed from checkout URL: `orderId=rvrhuugcleez2nxzm5ztza` (nanoid)

```
POST /baskets                    create basket (TBD)
GET  /baskets/{basket_id}        get basket (TBD)
POST /baskets/{basket_id}/items  add item (TBD)
DELETE /baskets/{basket_id}      clear basket (TBD)
POST /orders                     place order (TBD)
GET  /orders/{order_id}          track order (TBD)
GET  /orders                     order history (TBD)
```

---

## TODO — Phase 3 capture checklist

Run mitmproxy, open menu page, **click "Add to cart"** on any item:

- [ ] Capture BFF token exchange (how PKCE access_token → BFF JWT)
- [ ] Capture `POST /baskets` (create basket) — request + response shape
- [ ] Capture basket item add — endpoint + item payload format
- [ ] Capture `GET /baskets/{id}` — response shape
- [ ] Capture `POST /orders` (place order) — full request body
- [ ] Capture payment methods endpoint on `consumer.takeawaypay.com`
