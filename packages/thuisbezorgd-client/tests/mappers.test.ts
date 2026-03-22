import { describe, it, expect } from 'vitest';
import {
  mapRestaurantSummary,
  mapRestaurantMenu,
} from '../src/mappers.js';
import type {
  TBListingRestaurant,
  TBRestaurantCdnData,
} from '../src/types.js';

const listingRestaurant: TBListingRestaurant = {
  id: '10385916',
  name: 'Thunderbuns | Smash Burgers | Rijswijk',
  uniqueName: 'thunderbuns-smashburgers-rijswijk',
  brandName: 'Thunderbuns',
  address: {
    city: 'Rijswijk',
    firstLine: 'Dr. Colijnlaan 323',
    postalCode: '2283XL',
    location: {
      type: 'Point',
      coordinates: [4.321394, 52.04085],
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
  restaurantId: '10385916',
  restaurantInfo: {
    name: 'Thunderbuns | Smash Burgers | Rijswijk',
    seoName: 'thunderbuns-smashburgers-rijswijk',
    description: '',
    logoUrl: 'https://res.cloudinary.com/example/logo.png',
    bannerUrl: 'https://res.cloudinary.com/example/banner.png',
    location: {
      address: 'Dr. Colijnlaan 323',
      postCode: '2283XL',
      city: 'Rijswijk',
      latitude: 52.04085,
      longitude: 4.321394,
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

describe('mapRestaurantSummary', () => {
  it('maps SSR listing restaurant data to Restaurant', () => {
    const restaurant = mapRestaurantSummary(listingRestaurant);
    expect(restaurant.id).toBe('thunderbuns-smashburgers-rijswijk');
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
    expect(restaurant.id).toBe('thunderbuns-smashburgers-rijswijk');
    expect(restaurant.categories).toHaveLength(1);
    expect(restaurant.categories[0].items).toHaveLength(1);
    expect(restaurant.categories[0].items[0].price).toBe(1245);
    expect(restaurant.categories[0].items[0].option_groups).toHaveLength(2);
    expect(restaurant.categories[0].items[0].option_groups[0].options[0].price_delta).toBe(250);
    expect(restaurant.categories[0].items[0].option_groups[1].options[0].price_delta).toBe(300);
  });
});
