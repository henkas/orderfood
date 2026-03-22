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
import { NotFoundError, PlatformError } from '@orderfood/shared';
import {
  mapRestaurantMenu,
  mapRestaurantSummary,
} from './mappers.js';
import type {
  TBListingPageState,
  TBRestaurantCdnData,
} from './types.js';

const BASE = 'https://www.thuisbezorgd.nl/en';
const BASKET_STUB_MESSAGE = 'basket endpoints not yet captured';

export class ThuisbezorgdClient implements PlatformClient {
  async searchRestaurants(params: SearchParams): Promise<Restaurant[]> {
    const listingPath = buildListingPath(params.location);
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
    throw basketStub();
  }

  async addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[],
  ): Promise<Cart> {
    void restaurantId;
    void itemId;
    void quantity;
    void options;
    throw basketStub();
  }

  async clearCart(): Promise<void> {
    throw basketStub();
  }

  async getSavedAddresses(): Promise<Address[]> {
    throw basketStub();
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    throw basketStub();
  }

  async placeOrder(addressId: string, paymentMethodId: string): Promise<Order> {
    void addressId;
    void paymentMethodId;
    throw basketStub();
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

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
