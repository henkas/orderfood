import fetch from 'node-fetch';
import { randomUUID } from 'node:crypto';
import type {
  PlatformClient, SearchParams, Restaurant, RestaurantWithMenu,
  Cart, CartItemOption, Order, OrderStatus, Address, PaymentMethod,
} from '@orderfood/shared';
import { AuthError, NotFoundError, PlatformError, RateLimitError } from '@orderfood/shared';
import { loadCredentials, type UberEatsCredentials } from './auth.js';
import type {
  UEApiResponse, UEAddressSuggestion, UEDeliveryLocation,
  UEFeedResponse, UEStoreResponse, UEMenuItemResponse,
  UEDraftOrder, UEActiveOrder, UEPaymentProfile,
} from './types.js';
import {
  mapStore, mapRestaurantWithMenu, mapMenuItem, mapCart,
  mapActiveOrder, mapPaymentProfile,
} from './mappers.js';

const BASE = 'https://www.ubereats.com/_p/api';
const LOCALE = 'nl-en';

export class UberEatsClient implements PlatformClient {
  private credentials: UberEatsCredentials | null = null;
  private draftOrderUUID: string | null = null;

  private async getCreds(): Promise<UberEatsCredentials> {
    if (!this.credentials) {
      try {
        this.credentials = await loadCredentials();
      } catch {
        throw new AuthError(
          'Uber Eats credentials not found. Run: npx orderfood setup --platform ubereats',
          'AUTH_MISSING',
        );
      }
    }
    return this.credentials;
  }

  private async cookieHeader(): Promise<string> {
    const creds = await this.getCreds();
    return Object.entries(creds.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const cookie = await this.cookieHeader();
    const res = await fetch(`${BASE}/${endpoint}?localeCode=${LOCALE}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'x',
        cookie,
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1',
        referer: 'https://www.ubereats.com/nl-en',
        'accept-language': 'en-US,en;q=0.9',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      throw new RateLimitError('Uber Eats rate limit exceeded', retryAfter);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('Session expired. Re-run: npx orderfood setup --platform ubereats', 'AUTH_EXPIRED');
    }
    if (!res.ok) {
      throw new PlatformError(`Uber Eats API error: ${res.status}`, 'API_ERROR', res.status);
    }

    const json = (await res.json()) as UEApiResponse<T>;
    if (json.status !== 'success') {
      throw new PlatformError('Uber Eats returned non-success status', 'API_FAILURE');
    }
    return json.data;
  }

  private async resolveLocation(location: string): Promise<{ lat: number; lng: number; reference: string; address: string }> {
    const suggestions = await this.post<UEAddressSuggestion[]>('mapsSearchV1', { query: location });
    if (!suggestions || suggestions.length === 0) {
      throw new NotFoundError(`No location found for: ${location}`, 'LOCATION_NOT_FOUND');
    }
    const suggestion = suggestions[0];
    const upsert = await this.post<UEDeliveryLocation>('upsertDeliveryLocationV2', {
      addressInfo: {
        HOUSE_NUMBER: '',
        STREET_ADDRESS: suggestion.addressLine1,
        BUSINESS_NAME: '',
      },
      selectedInteractionType: 'door_to_door',
      deliveryPayloadType: 'USER_INPUT',
      isTargetLocation: true,
      referenceInfo: { placeID: suggestion.id, provider: suggestion.provider },
      label: '',
      deliveryInstruction: { pinDropInfo: null },
    });
    const loc = upsert.deliveryLocation.location;
    return {
      lat: loc.coordinate.latitude,
      lng: loc.coordinate.longitude,
      reference: suggestion.id,
      address: suggestion.addressLine1,
    };
  }

  private buildCacheKey(addr: { address: string; reference: string; lat: number; lng: number }): string {
    const obj = {
      address: addr.address,
      reference: addr.reference,
      referenceType: 'google_places',
      latitude: addr.lat,
      longitude: addr.lng,
    };
    return Buffer.from(encodeURIComponent(JSON.stringify(obj))).toString('base64');
  }

  async searchRestaurants(params: SearchParams): Promise<Restaurant[]> {
    const addr = await this.resolveLocation(params.location);
    const cacheKey = this.buildCacheKey({ address: addr.address, reference: addr.reference, lat: addr.lat, lng: addr.lng });

    const feed = await this.post<UEFeedResponse>('getFeedV1', {
      cacheKey,
      feedSessionCount: { announcementCount: 0, announcementLabel: '' },
      userQuery: params.query ?? '',
      date: '',
      startTime: 0,
      endTime: 0,
      sortAndFilters: [],
      isUserInitiatedRefresh: false,
      billboardUuid: '',
      feedProvider: '',
      promotionUuid: '',
      targetingStoreTag: '',
      venueUUID: '',
      selectedSectionUUID: '',
      favorites: '',
      vertical: '',
      searchSource: '',
      searchType: '',
      keyName: '',
      serializedRequestContext: '',
      carouselId: '',
    });

    const stores = Object.values(feed.storesMap).map(s => mapStore(s));

    if (params.cuisine) {
      const q = params.cuisine.toLowerCase();
      return stores.filter(s => s.cuisine.some(c => c.toLowerCase().includes(q)));
    }
    return stores;
  }

  async getRestaurant(restaurantId: string): Promise<RestaurantWithMenu> {
    const data = await this.post<UEStoreResponse>('getStoreV1', {
      storeUuid: restaurantId,
      diningMode: 'DELIVERY',
    });
    return mapRestaurantWithMenu(data);
  }

  async getCart(): Promise<Cart | null> {
    if (!this.draftOrderUUID) {
      // Try to recover from server
      const data = await this.post<{ draftOrders: UEDraftOrder[] }>('getDraftOrdersByEaterUuidV1', {});
      if (!data.draftOrders || data.draftOrders.length === 0) return null;
      this.draftOrderUUID = data.draftOrders[0].uuid;
    }
    const data = await this.post<{ draftOrder: UEDraftOrder }>('getDraftOrderByUuidV2', {
      draftOrderUUID: this.draftOrderUUID,
    });
    if (!data.draftOrder) return null;
    return mapCart(data.draftOrder);
  }

  async addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[],
  ): Promise<Cart> {
    // Get item details to fill sectionUuid, subsectionUuid, price, title
    const restaurant = await this.getRestaurant(restaurantId);
    let itemMeta: { sectionUuid: string; subsectionUuid: string; price: number; title: string } | null = null;
    for (const cat of restaurant.categories) {
      const item = cat.items.find(i => i.id === itemId);
      if (item) {
        // Retrieve from raw data — we store sectionUuid in the category name (limitation of current mapper)
        // For now use empty strings; this needs enhancement if sections are required
        itemMeta = { sectionUuid: '', subsectionUuid: '', price: item.price, title: item.name };
        break;
      }
    }
    if (!itemMeta) throw new NotFoundError(`Item ${itemId} not found in restaurant ${restaurantId}`, 'ITEM_NOT_FOUND');

    // Build existing items list
    const existingCart = await this.getCart();
    const existingItems = existingCart
      ? existingCart.items.map(ci => ({
          uuid: ci.item_id,
          shoppingCartItemUuid: randomUUID(),
          storeUuid: restaurantId,
          sectionUuid: '',
          subsectionUuid: '',
          price: ci.unit_price,
          title: ci.name,
          quantity: ci.quantity,
          customizations: {},
        }))
      : [];

    const newItem = {
      uuid: itemId,
      shoppingCartItemUuid: randomUUID(),
      storeUuid: restaurantId,
      sectionUuid: itemMeta.sectionUuid,
      subsectionUuid: itemMeta.subsectionUuid,
      price: itemMeta.price,
      title: itemMeta.title,
      quantity,
      customizations: buildCustomizations(options ?? []),
    };

    const data = await this.post<{ draftOrder: UEDraftOrder }>('createDraftOrderV2', {
      isMulticart: false,
      shoppingCartItems: [...existingItems, newItem],
    });
    this.draftOrderUUID = data.draftOrder.uuid;
    return mapCart(data.draftOrder);
  }

  async clearCart(): Promise<void> {
    if (!this.draftOrderUUID) return;
    // Create draft order with empty items list effectively replaces the cart
    await this.post<{ draftOrder: UEDraftOrder }>('createDraftOrderV2', {
      isMulticart: false,
      shoppingCartItems: [],
    });
    this.draftOrderUUID = null;
  }

  async getSavedAddresses(): Promise<Address[]> {
    // UE doesn't have a standalone saved-addresses endpoint in captured traffic.
    // Return empty list — users pass a location string to search_restaurants instead.
    return [];
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await this.post<{ profiles: { uuid: string; defaultPaymentProfileUuid: string }[] }>(
      'getProfilesForUserV1', {}
    );
    const defaultProfileUuid = data.profiles?.[0]?.defaultPaymentProfileUuid ?? '';

    const paymentsRes = await fetch(
      `https://payments.ubereats.com/_api/payment-profiles?flow=FLOW_SELECT&key=production_u2bkf0z5pn0e552g`,
      {
        headers: {
          cookie: await this.cookieHeader(),
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1',
        },
      }
    );
    if (!paymentsRes.ok) throw new PlatformError('Failed to fetch payment methods', 'PAYMENT_ERROR');
    const paymentsData = (await paymentsRes.json()) as { availablePaymentProfiles: UEPaymentProfile[] };

    return (paymentsData.availablePaymentProfiles ?? []).map(p => ({
      ...mapPaymentProfile(p),
      is_default: p.uuid === defaultProfileUuid,
    }));
  }

  async placeOrder(addressId: string, paymentMethodId: string): Promise<Order> {
    if (!this.draftOrderUUID) throw new PlatformError('Cart is empty', 'CART_EMPTY');

    // First update the draft order with delivery address + payment
    // addressId here is a location string (from getSavedAddresses or user input)
    // For now, addressId doubles as a free-form address string
    const addr = await this.resolveLocation(addressId);
    await this.post<unknown>('updateDraftOrderV2', {
      paymentProfileUUID: paymentMethodId,
      useCredits: true,
      deliveryType: 'ASAP',
      extraPaymentProfiles: [],
      interactionType: 'door_to_door',
      cartLockOptions: null,
      deliveryAddress: {
        latitude: addr.lat,
        longitude: addr.lng,
        address: { address1: addr.address, address2: '', aptOrSuite: '', eaterFormattedAddress: '', title: addr.address, subtitle: '' },
        reference: addr.reference,
        referenceType: 'google_places',
        type: 'google_places',
        addressComponents: { countryCode: '', firstLevelSubdivisionCode: '', city: '', postalCode: '' },
      },
      targetDeliveryTimeRange: { asap: true },
      diningMode: 'DELIVERY',
      draftOrderUUID: this.draftOrderUUID,
      paymentProfileSelectionSource: 'USER',
    });

    // The confirmed order placement endpoint is:
    //   POST /_p/api/checkoutOrdersByDraftOrdersV1?localeCode=nl-en
    //
    // The request body requires `checkoutActionResultParams.value` — a serialized JSON blob
    // produced by the browser-hosted payment provider flow at payments.ubereats.com.
    // This flow initiates an Apple Pay sheet or iDeal redirect that requires browser-level
    // payment APIs (PKPaymentRequest / iDeal hosted page).  There is no way to programmatically
    // complete this step without a browser with access to the payment provider session.
    //
    // To unblock this, the caller would need to:
    //   1. Load payments.ubereats.com/getPreCheckoutActions in a headless browser
    //   2. Complete the Apple Pay or iDeal step and capture the redirect result
    //   3. Pass the resulting `checkoutActionResultParams` blob here
    //
    // See docs/api-reference/ubereats.md § checkoutOrdersByDraftOrdersV1 for the full shape.
    throw new PlatformError(
      'place_order requires completing the payments.ubereats.com browser payment flow ' +
      '(Apple Pay or iDeal) to generate checkoutActionResultParams. ' +
      'This cannot be automated without a headless browser integration.',
      'NOT_IMPLEMENTED',
    );
  }

  async trackOrder(orderId: string): Promise<{ status: OrderStatus; details: string }> {
    const data = await this.post<{ orders: UEActiveOrder[] }>('getActiveOrdersV1', {
      orderUuid: orderId,
      timezone: 'Europe/Amsterdam',
      showAppUpsellIllustration: true,
    });
    const order = data.orders?.find(o => o.uuid === orderId) ?? data.orders?.[0];
    if (!order) throw new NotFoundError(`Order ${orderId} not found`, 'ORDER_NOT_FOUND');
    const mapped = mapActiveOrder(order);
    return { status: mapped.status, details: `Order is ${mapped.status}` };
  }

  async getOrderHistory(limit = 10): Promise<Order[]> {
    // getOrderEntitiesV1 returned null in capture — endpoint needs specific params
    // Stub implementation returns empty list with a TODO comment
    // TODO: capture order history flow in Uber Eats web app to discover correct request body
    return [];
  }

  async cancelOrder(orderId: string): Promise<void> {
    // TODO: cancelOrder endpoint not captured
    throw new PlatformError('cancel_order not yet implemented', 'NOT_IMPLEMENTED');
  }
}

function buildCustomizations(options: CartItemOption[]): Record<string, { uuid: string; price: number; quantity: number; title: string }[]> {
  const result: Record<string, { uuid: string; price: number; quantity: number; title: string }[]> = {};
  for (const opt of options) {
    const key = `${opt.group_id}+0`;
    if (!result[key]) result[key] = [];
    result[key].push({ uuid: opt.option_id, price: 0, quantity: 1, title: '' });
  }
  return result;
}
