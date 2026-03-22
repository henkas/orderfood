export interface TBCuisine {
  name: string;
  uniqueName?: string;
}

export interface TBListingRestaurant {
  id: string;
  name: string;
  uniqueName: string;
  brandName?: string;
  address?: {
    city?: string;
    firstLine?: string;
    postalCode?: string;
    location?: {
      type?: string;
      coordinates?: [number, number];
    };
  };
  rating?: {
    count?: number;
    starRating?: number;
  };
  isNew?: boolean;
  isOpenNowForDelivery?: boolean;
  isOpenNowForCollection?: boolean;
  deliveryEtaMinutes?: {
    rangeLower?: number;
    rangeUpper?: number;
  };
  deliveryFees?: {
    byMinFee?: {
      minimumAmount?: number;
      fee?: number;
    };
    byMaxFee?: {
      minimumAmount?: number;
      fee?: number;
    };
    numBands?: number;
  };
  cuisines?: TBCuisine[];
  logoUrl?: string;
  deals?: Array<{
    description?: string;
    offerType?: string;
  }>;
}

export interface TBListingPageState {
  restaurantList: {
    filteredRestaurantIds: string[];
  };
  restaurants: {
    lists: Record<string, TBListingRestaurant>;
  };
}

export interface TBImageSource {
  path: string;
  source?: string;
}

export interface TBCuisineType {
  id: string;
  name: string;
  seoName?: string;
  language?: string;
}

export interface TBRestaurantInfo {
  name: string;
  seoName: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  location?: {
    address?: string;
    postCode?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  cuisineTypes?: TBCuisineType[];
}

export interface TBMenuCategory {
  id: string;
  name: string;
  description?: string;
  preview?: string;
  itemIds: string[];
  parentIds: string[];
  imageSources?: TBImageSource[];
}

export interface TBMenuVariation {
  id: string;
  name: string;
  type: string;
  basePrice: number;
  dealOnly?: boolean;
  menuGroupIds?: string[];
  modifierGroupsIds?: string[];
}

export interface TBMenuItem {
  id: string;
  name: string;
  description?: string;
  type: string;
  imageSources?: TBImageSource[];
  variations?: TBMenuVariation[];
  hasVariablePrice?: boolean;
}

export interface TBModifierGroup {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
  modifiers: string[];
}

export interface TBModifierDefinition {
  id: string;
  name: string;
  additionPrice: number;
  removePrice?: number;
  defaultChoices?: number;
  minChoices?: number;
  maxChoices?: number;
}

export interface TBModifierSet {
  id: string;
  modifier: TBModifierDefinition;
}

export interface TBRestaurantCdnData {
  httpStatusCode: number;
  restaurantId: string;
  restaurantInfo: TBRestaurantInfo;
  menus: Array<{
    categories: TBMenuCategory[];
  }>;
  items: Record<string, TBMenuItem>;
  modifierGroups: TBModifierGroup[];
  modifierSets: TBModifierSet[];
}
