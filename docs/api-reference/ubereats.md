# Uber Eats API Reference

Discovered via mitmproxy capture of the Uber Eats web app (nl-en locale).
All example values are synthetic — no real credentials, addresses, or account UUIDs appear here.

**Base URL:** `https://www.ubereats.com/_p/api`
**Locale query param:** `?localeCode=nl-en` (append to every endpoint)

---

## Authentication

Uber Eats web uses **cookie-based session auth** — no explicit Bearer token header.
The session is established via `auth.uber.com` (OAuth redirect).

**Required cookies (obtain via `npx orderfood setup --platform ubereats`):**
| Cookie | Purpose |
|--------|---------|
| `sid` | Primary session token (Uber SSO) |
| `jwt-session` | Short-lived JWT (expires ~24h) |
| `uev2.id.session` | Session UUID |
| `uev2.loc` | URL-encoded delivery location JSON |
| `_userUuid` | Account UUID |

**Required headers on all API requests:**
```
x-csrf-token: x          ← literal string "x", always required
content-type: application/json
user-agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 ...)
```

---

## Location

### Address Autocomplete ✓

```
POST /mapsSearchV1
```

**Request:**
```json
{ "query": "Amsterdam Centraal" }
```

**Response:**
```json
[
  {
    "id": "ChIJ...",
    "provider": "google_places",
    "addressLine1": "Amsterdam Centraal, Amsterdam",
    "subtitle": "Amsterdam, Netherlands"
  }
]
```

---

### Upsert Delivery Location ✓

```
POST /upsertDeliveryLocationV2
```

Converts a place ID into a confirmed delivery location with GPS coordinates.

**Request:**
```json
{
  "addressInfo": {
    "HOUSE_NUMBER": "",
    "STREET_ADDRESS": "Amsterdam Centraal, Amsterdam",
    "BUSINESS_NAME": ""
  },
  "selectedInteractionType": "door_to_door",
  "deliveryPayloadType": "USER_INPUT",
  "isTargetLocation": true,
  "referenceInfo": { "placeID": "ChIJ...", "provider": "google_places" },
  "label": "",
  "deliveryInstruction": { "pinDropInfo": null }
}
```

**Response:**
```json
{
  "deliveryLocation": {
    "location": {
      "coordinate": { "latitude": 52.3791, "longitude": 4.8999 }
    },
    "uuid": "...",
    "title": "Amsterdam Centraal"
  }
}
```

---

## Restaurant Discovery

### Feed (restaurant list) ✓

```
POST /getFeedV1
```

**Request:**
```json
{
  "cacheKey": "<base64-encoded location+reference object>",
  "feedSessionCount": { "announcementCount": 0, "announcementLabel": "" },
  "userQuery": "",
  "date": "",
  "startTime": 0,
  "endTime": 0,
  "sortAndFilters": [],
  "isUserInitiatedRefresh": false,
  "billboardUuid": "",
  "feedProvider": "",
  "promotionUuid": "",
  "targetingStoreTag": "",
  "venueUUID": "",
  "selectedSectionUUID": "",
  "favorites": "",
  "vertical": "",
  "searchSource": "",
  "searchType": "",
  "keyName": "",
  "serializedRequestContext": "",
  "carouselId": ""
}
```

**`cacheKey` construction:**
```
base64(encodeURIComponent(JSON.stringify({
  address: "...",
  reference: "ChIJ...",
  referenceType: "google_places",
  latitude: 52.3791,
  longitude: 4.8999
})))
```

**Response shape:**
```json
{
  "status": "success",
  "data": {
    "storesMap": {
      "<store-uuid>": {
        "uuid": "64e7a603-0000-0000-0000-000000000000",
        "title": "Pizza Roma",
        "categories": ["Pizza", "Italian"],
        "rating": { "ratingValue": 4.5, "reviewCount": 320 },
        "etaRange": { "text": "25–35 min" },
        "fareInfo": {
          "deliveryFee": { "price": 199, "currencyCode": "EUR" },
          "minimumOrderValue": { "price": 1000, "currencyCode": "EUR" }
        },
        "heroImageUrl": "https://...",
        "isOpen": true
      }
    }
  }
}
```

**Note:** `deliveryFee.price` and `minimumOrderValue.price` are **integer cents**.

---

### Store Detail + Menu ✓

```
POST /getStoreV1
```

**Request:**
```json
{
  "storeUuid": "64e7a603-0000-0000-0000-000000000000",
  "diningMode": "DELIVERY"
}
```

**Response shape:**
```json
{
  "status": "success",
  "data": {
    "catalogSectionsMap": {
      "<section-uuid>": {
        "title": "Pizzas",
        "itemEntities": {
          "<item-uuid>": {
            "uuid": "item-uuid",
            "title": "Margherita",
            "itemDescription": "Classic tomato and mozzarella",
            "price": 1250,
            "imageUrl": "https://...",
            "customizationsList": [
              {
                "uuid": "cust-uuid",
                "title": "Choose size",
                "minPermitted": 1,
                "maxPermitted": 1,
                "options": [
                  { "uuid": "opt-uuid", "title": "Medium (25cm)", "price": 0, "defaultQuantity": 1 }
                ]
              }
            ]
          }
        }
      }
    }
  }
}
```

**Note:** Item `price` is **integer cents**.

---

## Cart (Draft Orders)

### Get Draft Orders ✓

```
POST /getDraftOrdersByEaterUuidV1
```

**Request:** `{}`

**Response:**
```json
{
  "status": "success",
  "data": {
    "draftOrders": [
      {
        "uuid": "draft-uuid",
        "storeUuid": "store-uuid",
        "shoppingCartItems": [ ... ]
      }
    ]
  }
}
```

---

### Get Draft Order by UUID ✓

```
POST /getDraftOrderByUuidV2
```

**Request:**
```json
{ "draftOrderUUID": "draft-uuid" }
```

---

### Create / Replace Draft Order ✓

```
POST /createDraftOrderV2
```

Replaces the entire cart. Pass an empty `shoppingCartItems` to clear.

**Request:**
```json
{
  "isMulticart": false,
  "shoppingCartItems": [
    {
      "uuid": "<item-uuid>",
      "shoppingCartItemUuid": "<random-uuid>",
      "storeUuid": "<store-uuid>",
      "sectionUuid": "<section-uuid>",
      "subsectionUuid": "",
      "price": 1250,
      "title": "Margherita",
      "quantity": 1,
      "customizations": {
        "<cust-uuid>+0": [
          { "uuid": "<opt-uuid>", "price": 0, "quantity": 1, "title": "Medium (25cm)" }
        ]
      }
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "draftOrder": {
      "uuid": "draft-uuid",
      "storeUuid": "store-uuid",
      "shoppingCartItems": [ ... ],
      "pricing": {
        "subtotalV2": { "price": 1250, "currencyCode": "EUR" },
        "deliveryFee": { "price": 199, "currencyCode": "EUR" },
        "totalV2": { "price": 1449, "currencyCode": "EUR" }
      }
    }
  }
}
```

---

## Checkout / Order Placement

The full order placement flow is **8 steps**. Steps 1–5 and 8 are REST API calls. Steps 6–7 require a browser-hosted payment provider flow.

### Step 1 — List Active Draft Orders ✓
`POST /getCartsViewForEaterUuidV1` — `{}` → lists active draft orders, same shape as `getDraftOrdersByEaterUuidV1`

### Step 2 — List Payment Profiles ✓

```
POST /getProfilesForUserV1
```

**Request:** `{}`

**Response:**
```json
{
  "status": "success",
  "data": {
    "profiles": [
      {
        "uuid": "profile-uuid",
        "defaultPaymentProfileUuid": "payment-uuid"
      }
    ]
  }
}
```

Payment profile details (card type, last 4, etc.) come from a separate call to:
```
GET https://payments.ubereats.com/_api/payment-profiles?flow=FLOW_SELECT&key=production_u2bkf0z5pn0e552g
```

### Step 3 — Select Active Profile ✓

```
POST /selectProfileV1
```

**Request:**
```json
{
  "profileUuid": "profile-uuid",
  "selectProfileSource": "SELECT_PROFILE_SOURCE_CLIENT_PROFILE_SWITCH"
}
```

### Step 4 — Update Draft Order (set address + payment) ✓

```
POST /updateDraftOrderV2
```

**Request:**
```json
{
  "paymentProfileUUID": "payment-uuid",
  "useCredits": true,
  "deliveryType": "ASAP",
  "extraPaymentProfiles": [],
  "interactionType": "door_to_door",
  "cartLockOptions": null,
  "deliveryAddress": {
    "latitude": 52.3791,
    "longitude": 4.8999,
    "address": {
      "address1": "Amsterdam Centraal",
      "address2": "",
      "aptOrSuite": "",
      "eaterFormattedAddress": "",
      "title": "Amsterdam Centraal",
      "subtitle": ""
    },
    "reference": "ChIJ...",
    "referenceType": "google_places",
    "type": "google_places",
    "addressComponents": {
      "countryCode": "NL",
      "firstLevelSubdivisionCode": "NH",
      "city": "Amsterdam",
      "postalCode": "1012 AB"
    }
  },
  "targetDeliveryTimeRange": { "asap": true },
  "diningMode": "DELIVERY",
  "draftOrderUUID": "draft-uuid",
  "paymentProfileSelectionSource": "USER"
}
```

### Step 5 — Checkout Presentation (fare breakdown) ✓

```
POST /getCheckoutPresentationV1
```

**Request:** `{ "draftOrderUUID": "draft-uuid" }`

Returns fare breakdown with subtotal, delivery fee, service fee, total — all integer cents.

### Steps 6–7 — Browser Payment Flow ⚠️ (not automatable)

The browser loads `payments.ubereats.com/getPreCheckoutActions` which initiates either:
- **Apple Pay** — presents a native payment sheet (requires `PKPaymentRequest`)
- **iDeal** — redirects to a hosted payment page

The result of completing this flow is serialized into `checkoutActionResultParams` (a JSON string) and passed to Step 8.

**This step cannot be automated without a headless browser with payment API access.**

### Step 8 — Place Order ✓ (shape confirmed, blocked by Step 6–7)

```
POST /checkoutOrdersByDraftOrdersV1
```

**Request:**
```json
{
  "draftOrderUUID": "draft-uuid",
  "storeInstructions": "",
  "isSingleUseItemsIncluded": false,
  "extraPaymentData": "",
  "shareCPFWithRestaurant": false,
  "extraParams": {
    "timezone": "Europe/Amsterdam",
    "storeUuid": "store-uuid",
    "cityName": "amsterdam",
    "paymentIntent": "personal",
    "paymentProfileTokenType": "UBER_PAY",
    "paymentProfileUuid": "payment-uuid",
    "isNeutralZoneEnabled": true,
    "isScheduledOrder": false,
    "isBillSplitOrder": false,
    "isDraftOrderParticipant": false,
    "isEditScheduledOrder": false,
    "orderTotalFare": 144900,
    "orderCurrency": "EUR",
    "checkoutType": "drafting",
    "isAddOnOrder": false,
    "promotionUuid": ""
  },
  "isGroupOrder": false,
  "checkoutActionResultParams": {
    "value": "<serialized JSON from payments.ubereats.com browser flow>"
  },
  "skipOrderRequestedEvent": false
}
```

**`orderTotalFare` encoding:** `amountE5` — amount × 100,000. €14.49 → `1449000`. Divide by 100,000 for euros, divide by 1,000 for integer cents.

**`checkoutActionResultParams.value` shape (serialized JSON string):**
```json
{
  "checkoutSessionUUID": "<uuid>",
  "useCaseKey": "<opaque string>",
  "actionResults": [
    {
      "actionUUID": "<uuid>",
      "status": "COMPLETE",
      "data": {
        "redirectUrlProvisionResult": {
          "redirectUrl": "https://payments.ubereats.com/resolve?flow=checkout&..."
        }
      },
      "paymentProfileUUID": "payment-uuid",
      "orderKey": 0
    }
  ],
  "estimatedPaymentPlan": {
    "defaultPaymentProfile": {
      "paymentProfileUUID": "payment-uuid",
      "currencyAmount": { "amountE5": 144900, "currencyCode": "EUR" }
    },
    "useCredits": true
  }
}
```

**Success response:**
```json
{
  "status": "success",
  "data": {
    "orderUUID": "<new-order-uuid>",
    "status": "ORDER_PLACED"
  }
}
```

**Failure response (payment error):**
```json
{
  "status": "failure",
  "data": {
    "code": "400",
    "meta": {
      "analyticsInfo": {
        "code": "eats.verify_payment_profile_error",
        "subCode": "payment_method_is_invalid"
      }
    }
  }
}
```

---

## Order Tracking

### Get Active Orders ✓

```
POST /getActiveOrdersV1
```

**Request:**
```json
{
  "orderUuid": "order-uuid",
  "timezone": "Europe/Amsterdam",
  "showAppUpsellIllustration": true
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "orders": [
      {
        "uuid": "order-uuid",
        "status": "ORDER_PREPARING",
        "estimatedDeliveryTime": 1700000000000,
        "restaurantName": "Pizza Roma"
      }
    ]
  }
}
```

**Status values observed:** `ORDER_PLACED`, `ORDER_ACCEPTED`, `ORDER_PREPARING`, `ORDER_PICKED_UP`, `ORDER_DELIVERED`, `ORDER_CANCELLED`

---

## Account

### Order History

Not yet captured. `getOrderEntitiesV1` was observed in traffic but returned null — exact request body not confirmed.

### Saved Addresses

Not exposed via a standalone endpoint in captured traffic. Delivery address is passed as a location string resolved through `mapsSearchV1` + `upsertDeliveryLocationV2`.

---

## Error Handling

All endpoints return HTTP 200 with `"status": "success"` or `"status": "failure"` in the body.

| HTTP status | Meaning |
|-------------|---------|
| 200 + `"status": "success"` | OK |
| 200 + `"status": "failure"` | Application-level error (see `data.code`) |
| 401 / 403 | Session expired — re-run setup |
| 429 | Rate limited — check `retry-after` header |
