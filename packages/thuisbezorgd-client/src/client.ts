import fetch from 'node-fetch';
import type {
  Address,
  Cart,
  CartItemOption,
  Order,
  OrderStatus,
  PaymentMethod,
  PlatformClient,
  Restaurant,
  RestaurantWithMenu,
  SearchParams,
} from '@orderfood/shared';
import {
  AuthError,
  NotFoundError,
  PlatformError,
  ValidationError,
} from '@orderfood/shared';
import {
  loadCredentials,
  refreshCredentials,
  saveCredentials,
  type ThuisbezorgdCredentials,
} from './auth.js';
import {
  mapBasketSummary,
  mapCheckoutCart,
  mapRestaurantMenu,
  mapRestaurantSummary,
  mapSavedAddresses,
  mapWalletPaymentMethods,
} from './mappers.js';
import type {
  TBBasketResponse,
  TBCheckoutResponse,
  TBListingPageState,
  TBRestaurantCdnData,
  TBSavedAddressesResponse,
  TBWalletResponse,
} from './types.js';

const BASE = 'https://www.thuisbezorgd.nl/en';
const REST_BASE = 'https://rest.api.eu-central-1.production.jet-external.com';
const BASKET_STUB_MESSAGE = 'basket endpoints not yet captured';

export class ThuisbezorgdClient implements PlatformClient {
  private credentials: ThuisbezorgdCredentials | null = null;
  private basketId: string | null = null;
  private lastSearchZipCode: string | null = null;
  private lastSearchGeoLocation:
    | { latitude: number; longitude: number }
    | null = null;

  async searchRestaurants(params: SearchParams): Promise<Restaurant[]> {
    const listingPath = buildListingPath(params.location);
    const postcode = extractZipCode(params.location);
    if (postcode) {
      this.lastSearchZipCode = postcode;
    }
    const html = await fetchHtml(
      `${BASE}/delivery/food/${listingPath}?openOnWeb=true`,
    );
    const listingState = parseListingState(html);

    let restaurants = listingState.restaurantList.filteredRestaurantIds
      .map((restaurantId) => listingState.restaurants.lists[restaurantId])
      .filter(Boolean)
      .map((restaurant) => mapRestaurantSummary(restaurant));

    if (params.query) {
      const query = params.query.toLowerCase();
      restaurants = restaurants.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(query),
      );
    }

    if (params.cuisine) {
      const cuisine = params.cuisine.toLowerCase();
      restaurants = restaurants.filter((restaurant) =>
        restaurant.cuisine.some((entry) => entry.toLowerCase().includes(cuisine)),
      );
    }

    return sortRestaurants(restaurants, params.sort_by);
  }

  async getRestaurant(restaurantId: string): Promise<RestaurantWithMenu> {
    const html = await fetchHtml(`${BASE}/menu/${restaurantId}`);
    const restaurant = parseMenuState(html);
    return mapRestaurantMenu(restaurant);
  }

  async getCart(): Promise<Cart | null> {
    if (!this.basketId) return null;
    const checkout = await this.restGet<TBCheckoutResponse>(
      `/checkout/nl/${this.basketId}`,
      'application/json;v=2',
    );
    return mapCheckoutCart(checkout);
  }

  async addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[],
  ): Promise<Cart> {
    const html = await fetchHtml(`${BASE}/menu/${restaurantId}`);
    const restaurant = parseMenuState(html);
    const product = buildBasketProduct(restaurant, itemId, quantity, options ?? []);
    const location = resolveOrderLocation(
      restaurant,
      this.lastSearchZipCode,
      this.lastSearchGeoLocation,
    );

    if (!this.basketId) {
      const basket = await this.restRequest<TBBasketResponse>(
        '/basket',
        {
          method: 'POST',
          body: JSON.stringify({
            deals: [],
            products: [product],
            orderDetails: {
              location: {
                zipCode: location.zipCode,
                geoLocation: location.geoLocation,
              },
            },
            menuGroupId: product.menuGroupId,
            restaurantSeoName: restaurant.restaurantInfo.seoName,
            serviceType: 'delivery',
            consents: [],
          }),
        },
        'application/json;v=1.0',
      );
      this.basketId = basket.BasketId;
      return mapBasketSummary(basket);
    }

    const basket = await this.restRequest<TBBasketResponse>(
      `/basket/${this.basketId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          basketId: this.basketId,
          deal: { added: [] },
          product: { added: [product] },
          orderDetails: {
            location: {
              zipCode: { value: location.zipCode },
              geoLocation: { value: location.geoLocation },
            },
          },
          selectedServiceType: {
            date: new Date().toISOString(),
            value: 'delivery',
          },
          consents: [],
          restaurantSeoName: restaurant.restaurantInfo.seoName,
        }),
      },
      'application/json;v=1.0',
    );
    this.basketId = basket.BasketId;
    return mapBasketSummary(basket);
  }

  async clearCart(): Promise<void> {
    if (!this.basketId) return;
    await this.restRequest(`/basket/${this.basketId}`, {
      method: 'DELETE',
    });
    this.basketId = null;
  }

  async getSavedAddresses(): Promise<Address[]> {
    const response = await this.restGet<TBSavedAddressesResponse>(
      '/applications/international/consumer/me/address',
    );
    return mapSavedAddresses(response);
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await this.restGet<TBWalletResponse>('/consumers/nl/wallet');
    return mapWalletPaymentMethods(response);
  }

  async placeOrder(addressId: string, paymentMethodId: string): Promise<Order> {
    void addressId;
    void paymentMethodId;
    throw new ValidationError(
      'Thuisbezorgd payment is completed in the browser via Adyen. Finish checkout manually in the browser.',
      'PAYMENT_IN_BROWSER',
    );
  }

  async trackOrder(
    orderId: string,
  ): Promise<{ status: OrderStatus; details: string }> {
    void orderId;
    throw basketStub();
  }

  async getOrderHistory(limit?: number): Promise<Order[]> {
    void limit;
    throw basketStub();
  }

  async cancelOrder(orderId: string): Promise<void> {
    void orderId;
    throw basketStub();
  }

  private async getCreds(): Promise<ThuisbezorgdCredentials> {
    if (!this.credentials) {
      try {
        this.credentials = await loadCredentials();
      } catch {
        throw new AuthError(
          'Thuisbezorgd credentials not found. Run: npx orderfood setup --platform thuisbezorgd',
          'AUTH_MISSING',
        );
      }
    }
    if (this.credentials.expires_at <= Math.floor(Date.now() / 1000) + 60) {
      this.credentials = await refreshCredentials(this.credentials);
      await saveCredentials(this.credentials);
    }
    return this.credentials;
  }

  private async restGet<T>(
    path: string,
    contentType = 'application/json',
  ): Promise<T> {
    return this.restRequest<T>(path, { method: 'GET' }, contentType);
  }

  private async restRequest<T = void>(
    path: string,
    init: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: string;
    },
    contentType = 'application/json',
  ): Promise<T> {
    const creds = await this.getCreds();
    const res = await fetch(`${REST_BASE}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${creds.access_token}`,
        accept: 'application/json, text/plain, */*',
        'content-type': contentType,
      },
      body: init.body,
    });

    if (res.status === 401 || res.status === 403) {
      throw new AuthError(
        'Thuisbezorgd access token expired. Re-run: npx orderfood setup --platform thuisbezorgd',
        'AUTH_EXPIRED',
      );
    }
    if (res.status === 404) {
      throw new NotFoundError(`Thuisbezorgd resource not found: ${path}`, 'NOT_FOUND');
    }
    if (!res.ok) {
      throw new PlatformError(
        `Thuisbezorgd REST request failed: ${res.status}`,
        'HTTP_ERROR',
        res.status,
      );
    }
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }
}

export function parseListingState(html: string): TBListingPageState {
  return {
    restaurantList: extractNamedObject(
      html,
      'restaurantList',
    ) as TBListingPageState['restaurantList'],
    restaurants: extractNamedObject(
      html,
      'restaurants',
    ) as TBListingPageState['restaurants'],
  };
}

export function parseMenuState(html: string): TBRestaurantCdnData {
  const cdn = extractNamedObject(html, 'cdn') as {
    restaurant?: TBRestaurantCdnData;
  };
  if (!cdn.restaurant) {
    throw new NotFoundError(
      'Unable to parse Thuisbezorgd menu state',
      'MENU_PARSE_FAILED',
    );
  }
  return cdn.restaurant;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (res.status === 404) {
    throw new NotFoundError(`Thuisbezorgd page not found: ${url}`, 'NOT_FOUND');
  }
  if (!res.ok) {
    throw new PlatformError(
      `Thuisbezorgd request failed: ${res.status}`,
      'HTTP_ERROR',
      res.status,
    );
  }
  return res.text();
}

function extractNamedObject(html: string, name: string): unknown {
  const marker = `"${name}":`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new NotFoundError(
      `Unable to find "${name}" in Thuisbezorgd page state`,
      'STATE_NOT_FOUND',
    );
  }

  const objectStart = html.indexOf('{', markerIndex + marker.length);
  if (objectStart === -1) {
    throw new NotFoundError(
      `Unable to find object start for "${name}"`,
      'STATE_NOT_FOUND',
    );
  }

  return JSON.parse(extractBalancedJson(html, objectStart));
}

function extractBalancedJson(source: string, startIndex: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const ch = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new NotFoundError(
    'Unable to extract balanced JSON from Thuisbezorgd page state',
    'STATE_NOT_FOUND',
  );
}

function buildListingPath(location: string): string {
  const postcodeMatch = location.match(/\b\d{4}\s?[A-Za-z]{2}\b/);
  if (!postcodeMatch) {
    return slugify(location);
  }

  const postcode = postcodeMatch[0].replace(/\s+/g, '').toLowerCase();
  const city = slugify(location.replace(postcodeMatch[0], '').trim());
  return city ? `${city}-${postcode}` : postcode;
}

function extractZipCode(location: string): string | null {
  const postcodeMatch = location.match(/\b\d{4}\s?[A-Za-z]{2}\b/);
  if (!postcodeMatch) return null;
  const normalized = postcodeMatch[0].replace(/\s+/g, '').toUpperCase();
  return `${normalized.slice(0, 4)} ${normalized.slice(4)}`;
}

function slugify(input: string): string {
  // split on the separator then filter empty segments — avoids any trailing/leading
  // hyphen trimming regex that CodeQL flags as polynomial-ReDoS vulnerable
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .join('-');
}

function sortRestaurants(
  restaurants: Restaurant[],
  sortBy?: SearchParams['sort_by'],
): Restaurant[] {
  const sorted = [...restaurants];
  switch (sortBy) {
    case 'delivery_time':
      return sorted.sort(
        (left, right) => left.delivery_time_min - right.delivery_time_min,
      );
    case 'delivery_fee':
      return sorted.sort(
        (left, right) => left.delivery_fee - right.delivery_fee,
      );
    case 'rating':
    default:
      return sorted.sort((left, right) => right.rating - left.rating);
  }
}

function basketStub(): NotFoundError {
  return new NotFoundError(BASKET_STUB_MESSAGE, 'NOT_IMPLEMENTED');
}

function buildBasketProduct(
  restaurant: TBRestaurantCdnData,
  itemId: string,
  quantity: number,
  options: CartItemOption[],
) {
  const item = restaurant.items[itemId];
  const variation = item?.variations?.[0];
  if (!item || !variation || !variation.menuGroupIds?.[0]) {
    throw new NotFoundError(
      `Item ${itemId} not found in Thuisbezorgd restaurant ${restaurant.restaurantInfo.seoName}`,
      'ITEM_NOT_FOUND',
    );
  }

  const groupedOptions = new Map<string, string[]>();
  for (const option of options) {
    const entries = groupedOptions.get(option.group_id) ?? [];
    entries.push(option.option_id);
    groupedOptions.set(option.group_id, entries);
  }

  return {
    date: new Date().toISOString(),
    productId: variation.id,
    quantity,
    customerNotes: '',
    modifierGroups: [...groupedOptions.entries()].map(([groupId, modifierIds]) => ({
      modifierGroupId: groupId,
      modifiers: modifierIds.map((modifierId) => ({
        modifierId,
        quantity: 1,
      })),
    })),
    dealGroups: [],
    menuGroupId: variation.menuGroupIds[0],
  };
}

function resolveOrderLocation(
  restaurant: TBRestaurantCdnData,
  cachedZipCode: string | null,
  cachedGeoLocation: { latitude: number; longitude: number } | null,
) {
  const restaurantLocation = restaurant.restaurantInfo.location;
  const zipCode = cachedZipCode ?? restaurantLocation?.postCode;
  const geoLocation = cachedGeoLocation ?? {
    latitude: restaurantLocation?.latitude ?? 0,
    longitude: restaurantLocation?.longitude ?? 0,
  };

  if (!zipCode) {
    throw new ValidationError(
      'A delivery postcode is required before adding items to a Thuisbezorgd basket.',
      'ZIP_REQUIRED',
    );
  }

  return { zipCode, geoLocation };
}
