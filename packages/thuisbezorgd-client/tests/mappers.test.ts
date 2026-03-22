import { describe, it, expect } from 'vitest';
import {
  mapCheckoutCart,
  mapRestaurantSummary,
  mapRestaurantMenu,
  mapSavedAddresses,
  mapWalletPaymentMethods,
} from '../src/mappers.js';
import type {
  TBCheckoutResponse,
  TBListingRestaurant,
  TBRestaurantCdnData,
  TBSavedAddressesResponse,
  TBWalletResponse,
} from '../src/types.js';

const listingRestaurant: TBListingRestaurant = {
  id: '12345678',
  name: 'Pasta Palace | Amsterdam',
  uniqueName: 'pasta-palace-amsterdam',
  brandName: 'Pasta Palace',
  address: {
    city: 'Amsterdam',
    firstLine: 'Voorbeeldstraat 1',
    postalCode: '1012 AB',
    location: {
      type: 'Point',
      coordinates: [4.895, 52.370],
    },
  },
  rating: {
    count: 203,
    starRating: 4,
  },
  isOpenNowForDelivery: true,
  deliveryEtaMinutes: {
    rangeLower: 35,
    rangeUpper: 50,
  },
  deliveryFees: {
    byMinFee: {
      minimumAmount: 1000,
      fee: 299,
    },
    byMaxFee: {
      minimumAmount: 1000,
      fee: 299,
    },
    numBands: 1,
  },
  cuisines: [
    { name: 'Burgers', uniqueName: 'burger' },
    { name: '100% Halal', uniqueName: '100-percent-halal' },
  ],
  logoUrl:
    'https://res.cloudinary.com/tkwy-prod-eu/image/upload/logo_465x320.png',
};

const menuRestaurant: TBRestaurantCdnData = {
  httpStatusCode: 200,
  restaurantId: '12345678',
  restaurantInfo: {
    name: 'Pasta Palace | Amsterdam',
    seoName: 'pasta-palace-amsterdam',
    description: '',
    logoUrl: 'https://res.cloudinary.com/example/logo.png',
    bannerUrl: 'https://res.cloudinary.com/example/banner.png',
    location: {
      address: 'Voorbeeldstraat 1',
      postCode: '1012 AB',
      city: 'Amsterdam',
      latitude: 52.370,
      longitude: 4.895,
    },
    cuisineTypes: [
      {
        id: '78',
        name: 'Burgers',
        seoName: 'burger',
        language: 'en',
      },
    ],
  },
  menus: [
    {
      categories: [
        {
          id: '9f41b014-dde5-47f4-b812-7776043def69',
          name: 'Burgers',
          description: '',
          preview: 'The Classic Bun',
          itemIds: ['9e1db55d-f534-4fe3-b756-54638b54d361'],
          parentIds: [],
          imageSources: [
            {
              path: 'https://just-eat-prod-eu-res.cloudinary.com/category.png',
              source: 'Cloudinaryv2',
            },
          ],
        },
      ],
    },
  ],
  items: {
    '9e1db55d-f534-4fe3-b756-54638b54d361': {
      id: '9e1db55d-f534-4fe3-b756-54638b54d361',
      name: 'The Classic Bun',
      description: 'Our classic smash burger...',
      type: 'menuitem',
      imageSources: [
        {
          path: 'https://just-eat-prod-eu-res.cloudinary.com/item.png',
          source: 'Cloudinaryv2',
        },
      ],
      variations: [
        {
          id: '9e1db55d-f534-4fe3-b756-54638b54d361',
          name: 'The Classic Bun',
          type: 'NoVariation',
          basePrice: 12.45,
          dealOnly: false,
          menuGroupIds: ['3D5284195046B43DA09CD41188AA546B'],
          modifierGroupsIds: [
            '55c376bb-7757-4f97-9378-4652ce2583a9',
            'fa5c416d-1ecf-4283-a01a-9c447ff9faf6',
          ],
        },
      ],
      hasVariablePrice: false,
    },
  },
  modifierGroups: [
    {
      id: '55c376bb-7757-4f97-9378-4652ce2583a9',
      name: 'With calf bacon?',
      minChoices: 0,
      maxChoices: 1,
      modifiers: ['6'],
    },
    {
      id: 'fa5c416d-1ecf-4283-a01a-9c447ff9faf6',
      name: 'Extras',
      minChoices: 0,
      maxChoices: 1,
      modifiers: ['7'],
    },
  ],
  modifierSets: [
    {
      id: '6',
      modifier: {
        id: '6bd56fb7-eee4-4e17-9057-49e2462363b7',
        name: 'With calf bacon',
        additionPrice: 2.5,
        removePrice: 0,
        defaultChoices: 0,
        minChoices: 0,
        maxChoices: 1,
      },
    },
    {
      id: '7',
      modifier: {
        id: 'ce1d02e6-7ff1-45af-9ad9-e3d3fa75f71f',
        name: 'Extra patty',
        additionPrice: 3,
        removePrice: 0,
        defaultChoices: 0,
        minChoices: 0,
        maxChoices: 1,
      },
    },
  ],
};

const checkoutResponse: TBCheckoutResponse = {
  restaurant: {
    id: '98765432',
    name: 'Burger Joint',
    seoName: 'burger-joint',
    location: {
      address: {
        lines: ['Kempstraat 141'],
        locality: 'Den Haag',
        postalCode: '2572 GD',
      },
      geolocation: {
        latitude: 52.064987,
        longitude: 4.292233,
      },
    },
  },
  purchase: {
    groups: [
      {
        products: [
          {
            id: 'e7589a25-product',
            name: 'Classic Burger',
            quantity: 1,
            price: {
              amount: 1400,
              formattedAmount: '€ 14,00',
            },
            options: [{ name: 'Medium', quantity: 1 }],
          },
        ],
      },
    ],
  },
};

const savedAddresses: TBSavedAddressesResponse = {
  Addresses: [
    {
      AddressId: 5659709812,
      City: 'Den Haag',
      ZipCode: '2572 GD',
      AddressName: 'Home',
      Line1: 'Kempstraat 141',
    },
  ],
  DefaultAddress: 5659709812,
};

const walletResponse: TBWalletResponse = {
  data: [
    {
      id: 'wallet-card-1',
      paymentMethodType: 'Card',
      brand: 'Visa',
      lastFourDigits: '4242',
      isDefault: true,
    },
    {
      id: 'wallet-ideal-1',
      paymentMethodType: 'iDEAL',
      label: 'iDEAL',
      isDefault: false,
    },
  ],
};

describe('mapRestaurantSummary', () => {
  it('maps SSR listing restaurant data to Restaurant', () => {
    const restaurant = mapRestaurantSummary(listingRestaurant);
    expect(restaurant.id).toBe('pasta-palace-amsterdam');
    expect(restaurant.platform).toBe('thuisbezorgd');
    expect(restaurant.delivery_fee).toBe(299);
    expect(restaurant.min_order).toBe(1000);
    expect(restaurant.delivery_time_min).toBe(35);
    expect(restaurant.cuisine).toEqual(['Burgers', '100% Halal']);
  });
});

describe('mapRestaurantMenu', () => {
  it('maps SSR menu state to RestaurantWithMenu with modifiers', () => {
    const restaurant = mapRestaurantMenu(menuRestaurant);
    expect(restaurant.id).toBe('pasta-palace-amsterdam');
    expect(restaurant.categories).toHaveLength(1);
    expect(restaurant.categories[0].items).toHaveLength(1);
    expect(restaurant.categories[0].items[0].price).toBe(1245);
    expect(restaurant.categories[0].items[0].option_groups).toHaveLength(2);
    expect(restaurant.categories[0].items[0].option_groups[0].options[0].price_delta).toBe(250);
    expect(restaurant.categories[0].items[0].option_groups[1].options[0].price_delta).toBe(300);
  });
});

describe('mapCheckoutCart', () => {
  it('maps checkout products priced in cents to Cart', () => {
    const cart = mapCheckoutCart(checkoutResponse);
    expect(cart.restaurant_id).toBe('burger-joint');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].unit_price).toBe(1400);
    expect(cart.total).toBe(1400);
  });
});

describe('mapSavedAddresses', () => {
  it('maps saved addresses to shared Address type', () => {
    const addresses = mapSavedAddresses(savedAddresses);
    expect(addresses).toHaveLength(1);
    expect(addresses[0].id).toBe('5659709812');
    expect(addresses[0].label).toBe('Home');
    expect(addresses[0].formatted).toContain('Kempstraat 141');
  });
});

describe('mapWalletPaymentMethods', () => {
  it('maps wallet entries to shared PaymentMethod type', () => {
    const methods = mapWalletPaymentMethods(walletResponse);
    expect(methods).toHaveLength(2);
    expect(methods[0].type).toBe('card');
    expect(methods[0].is_default).toBe(true);
    expect(methods[1].type).toBe('ideal');
  });
});
