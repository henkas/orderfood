# Thuisbezorgd API Reference

> **Phase 3 capture complete** — all confirmed. Auth, restaurant listing, menu,
> basket create/update, checkout summary, addresses, and payment methods all
> captured via HAR export. Order placement (payment step) handled by Adyen on
> `pay.thuisbezorgd.nl` — out of scope for automated flow.

---

## Overview

| Concern | Domain | Auth needed |
|---------|--------|-------------|
| Restaurant listing | `www.thuisbezorgd.nl/en/delivery/food/{city}-{postcode}` | No (public SSR) |
| Restaurant menu | `www.thuisbezorgd.nl/en/menu/{slug}` | No (public SSR) |
| Auth | `auth.thuisbezorgd.nl` | — |
| REST API (basket, checkout, account) | `https://rest.api.eu-central-1.production.jet-external.com` | Yes — PKCE Bearer token |
| Order placement + payment | `pay.thuisbezorgd.nl` (Adyen) | Out of scope |

**⚠️ The basket/order API is NOT at `cw-api.takeaway.com`.** It is at
`rest.api.eu-central-1.production.jet-external.com`. The PKCE `access_token`
is used as the Bearer token directly — no separate token exchange needed.

**Two data retrieval strategies (confirmed):**
- Public pages (restaurants, menu): `GET` the SSR Next.js page, parse embedded state JSON
- Interactive operations (basket, account): `GET/POST` REST endpoints with `Authorization: Bearer {access_token}`

**Price encoding (⚠️ inconsistent across sources):**
- `deliveryFees.*.fee` in restaurant listing: **integer cents** (`299` = €2.99) ✓
- `basePrice` / `additionPrice` in menu CDN data: **float euros** (`12.45` = €12.45) ✓
- `BasketSummary.Products.TotalPrice` in basket response: **float euros** (`14.0`) ✓
- `purchase.products.price.amount` in checkout response: **integer cents** (`1400`) ✓
- All values stored in shared types must be integer cents

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
  "id": "12345678",
  "name": "Pasta Palace | Amsterdam",
  "uniqueName": "pasta-palace-amsterdam",
  "brandName": "Pasta Palace",
  "address": {
    "city": "Amsterdam",
    "firstLine": "Voorbeeldstraat 1",
    "postalCode": "1012 AB",
    "location": {"type": "Point", "coordinates": [4.895, 52.370]}
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
  "restaurantId": "12345678",
  "restaurantInfo": {
    "name": "Pasta Palace | Amsterdam",
    "seoName": "pasta-palace-amsterdam",
    "description": "",
    "logoUrl": "https://res.cloudinary.com/...",
    "bannerUrl": "https://res.cloudinary.com/...",
    "location": {
      "address": "Voorbeeldstraat 1",
      "postCode": "1012 AB",
      "city": "Amsterdam",
      "latitude": 52.370,
      "longitude": 4.895
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

## REST API ✓

```
Base URL: https://rest.api.eu-central-1.production.jet-external.com
Headers:
  Authorization: Bearer {access_token}   ← PKCE token, no exchange needed
  Accept: application/json, text/plain, */*
  Content-Type: application/json;v=1.0   (basket writes)
  Content-Type: application/json;v=2     (checkout reads)
```

---

## Basket — Create ✓

```
POST /basket
Content-Type: application/json;v=1.0

{
  "deals": [],
  "products": [{
    "date": "2026-03-22T22:06:04.032Z",
    "productId": "e7589a25-2324-4c00-a5f1-47df09424471",
    "quantity": 1,
    "customerNotes": "",
    "modifierGroups": [
      {
        "modifierGroupId": "7b425680-1793-4967-bf15-ea654880fa41",
        "modifiers": [{"modifierId": "4ac7992d-28a9-492b-973a-32a794ac5960", "quantity": 1}]
      }
    ],
    "dealGroups": []
  }],
  "orderDetails": {
    "location": {
      "zipCode": "1234 AB",
      "geoLocation": {"latitude": 52.370, "longitude": 4.895}
    }
  },
  "menuGroupId": "D38B48EBBC2CE1C817ABBD5155E1FD43",
  "restaurantSeoName": "burger-joint",
  "serviceType": "delivery",
  "consents": []
}
```

**Response:**
```json
{
  "BasketId": "MTczMDFlMzctZDFkNS00Ym-v1",
  "Currency": "EUR",
  "RestaurantSeoName": "burger-joint",
  "RestaurantId": "98765432",
  "MenuGroupId": "D38B48EBBC2CE1C817ABBD5155E1FD43",
  "ServiceType": "Delivery",
  "BasketSummary": {
    "Products": [{
      "BasketProductIds": ["eac31a866efa9b30fcd6"],
      "Name": "Classic Burger",
      "Quantity": 1,
      "TotalPrice": 14.0,
      "UnitPrice": 14.0,
      "ProductId": "e7589a25-2324-4c00-a5f1-47df09424471",
      "ModifierGroups": [...]
    }]
  }
}
```

`TotalPrice` / `UnitPrice` are **float euros** — multiply × 100 for cents.

---

## Basket — Add Item ✓

```
PUT /basket/{basketId}
Content-Type: application/json;v=1.0

{
  "basketId": "MTczMDFlMzctZDFkNS00Ym-v1",
  "deal": {"added": []},
  "product": {
    "added": [{
      "date": "2026-03-22T22:06:21.566Z",
      "productId": "9d9484ff-2abf-40e1-a8a8-037c849de74b",
      "quantity": 1,
      "customerNotes": "",
      "modifierGroups": [...],
      "dealGroups": []
    }]
  },
  "orderDetails": {
    "location": {
      "zipCode": {"value": "1234 AB"},
      "geoLocation": {"value": {"latitude": 52.370, "longitude": 4.895}}
    }
  },
  "selectedServiceType": {"date": "2026-03-22T22:06:21.567Z", "value": "delivery"},
  "consents": [],
  "restaurantSeoName": "burger-joint"
}
```

**⚠️ `orderDetails.location` format differs from create:**
- `POST /basket`: `zipCode` is a plain string
- `PUT /basket/{id}`: `zipCode` is `{"value": "..."}`, `geoLocation` is `{"value": {...}}`

Response shape same as basket create.

---

## Basket — Delete ✓ (inferred)

```
DELETE /basket/{basketId}
```

---

## Checkout Summary ✓

```
GET /checkout/nl/{basketId}
Content-Type: application/json;v=2
```

**Response (prices in integer cents):**
```json
{
  "restaurant": {
    "id": "98765432",
    "name": "Burger Joint",
    "seoName": "burger-joint",
    "location": {
      "address": {"lines": ["Kempstraat 141"], "locality": "Den Haag", "postalCode": "2572 GD"},
      "geolocation": {"latitude": 52.064987, "longitude": 4.292233}
    }
  },
  "purchase": {
    "groups": [{
      "products": [{
        "id": "e7589a25-...",
        "name": "Classic Burger",
        "quantity": 1,
        "price": {"amount": 1400, "formattedAmount": "€ 14,00"},
        "options": [{"name": "Medium", "quantity": 1}]
      }]
    }]
  }
}
```

---

## Account Endpoints ✓

```
GET /applications/international/consumer/me
→ {Email, Name, PhoneNumber, ConsumerStatus, CreatedDate}

GET /applications/international/consumer/me/address
→ {
    Addresses: [{AddressId, City, ZipCode, AddressName, Line1}],
    DefaultAddress: 5659709812
  }

GET /consumers/nl/wallet
→ {data: [...]}   (empty if no saved cards — iDeal/Apple Pay are session-only)
```

---

## Order Placement

Payment is handled by `pay.thuisbezorgd.nl` (Adyen). The `orderId` (nanoid,
e.g. `cp2fzi7qducl02tfs0v70w`) is assigned by the payment service and returned
in the checkout redirect URL. Full automated payment is out of scope.

For `place_order`: create basket, return `{basketId, checkoutUrl}` for the user
to complete payment in the browser.
