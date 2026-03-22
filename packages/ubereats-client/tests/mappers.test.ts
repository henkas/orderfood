import { describe, it, expect } from 'vitest';
import { mapStore, mapRestaurantWithMenu, mapCart, mapActiveOrder } from '../src/mappers.js';
import type { UEStoreCard, UEStoreResponse, UEDraftOrder, UEActiveOrder } from '../src/types.js';

const mockStoreCard: UEStoreCard = {
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  title: { text: 'Pizza Place' },
  rating: { text: '4.8', accessibilityText: '4.8 stars' },
  etaRange: { text: '25-35 min' },
  fareInfo: { displayString: '€0.99 delivery' },
  cuisineList: { cuisines: [{ uuid: '1', name: 'Italian' }] },
};

const mockStoreResponse: UEStoreResponse = {
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Pizza Place',
  rating: { text: '4.8' },
  etaRange: { text: '25-35 min' },
  fareInfo: { displayString: '€0.99 delivery' },
  cuisineList: { cuisines: [{ uuid: '1', name: 'Italian' }] },
  heroImageUrls: [{ url: 'https://example.com/pizza.jpg' }],
  sections: [{ uuid: 'sec-1', title: 'Pizzas', subsectionUuids: ['sub-1'] }],
  catalogSectionsMap: {
    'sec-1': [{
      type: 'VERTICAL_GRID',
      catalogSectionUUID: 'sec-1',
      payload: {
        standardItemsPayload: {
          title: { text: 'Pizzas' },
          catalogItems: [{
            uuid: 'item-1',
            title: 'Margherita',
            itemDescription: 'Classic tomato and mozzarella',
            price: 1299,
            isSoldOut: false,
            hasCustomizations: false,
            sectionUuid: 'sec-1',
            subsectionUuid: 'sub-1',
          }],
          sectionUUID: 'sec-1',
        },
      },
    }],
  },
};

describe('mapStore', () => {
  it('maps a feed store card to Restaurant', () => {
    const r = mapStore(mockStoreCard);
    expect(r.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(r.platform).toBe('ubereats');
    expect(r.name).toBe('Pizza Place');
    expect(r.rating).toBe(4.8);
    expect(r.cuisine).toEqual(['Italian']);
    expect(r.delivery_time_min).toBe(25);
  });
});

describe('mapRestaurantWithMenu', () => {
  it('maps a store response to RestaurantWithMenu with categories', () => {
    const r = mapRestaurantWithMenu(mockStoreResponse);
    expect(r.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(r.categories).toHaveLength(1);
    expect(r.categories[0].name).toBe('Pizzas');
    expect(r.categories[0].items).toHaveLength(1);
    expect(r.categories[0].items[0].id).toBe('item-1');
    expect(r.categories[0].items[0].price).toBe(1299);
    expect(r.categories[0].items[0].option_groups).toEqual([]);
  });
});

describe('mapActiveOrder', () => {
  it('maps an active order to Order', () => {
    const ueOrder: UEActiveOrder = {
      uuid: 'order-uuid-123',
      storeInfo: { title: 'Pizza Place' },
      status: 'PREPARING',
      scheduledAt: '2026-03-22T19:00:00.000Z',
    };
    const o = mapActiveOrder(ueOrder);
    expect(o.id).toBe('order-uuid-123');
    expect(o.status).toBe('preparing');
    expect(o.restaurant_name).toBe('Pizza Place');
  });
});
