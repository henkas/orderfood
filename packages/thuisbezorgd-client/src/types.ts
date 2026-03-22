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

export interface TBBasketModifier {
  ModifierId?: string;
  modifierId?: string;
  Name?: string;
  name?: string;
  Quantity?: number;
  quantity?: number;
}

export interface TBBasketModifierGroup {
  ModifierGroupId?: string;
  modifierGroupId?: string;
  Name?: string;
  name?: string;
  Modifiers?: TBBasketModifier[];
  modifiers?: TBBasketModifier[];
}

export interface TBBasketSummaryProduct {
  BasketProductIds?: string[];
  Name?: string;
  name?: string;
  Quantity?: number;
  quantity?: number;
  TotalPrice?: number;
  totalPrice?: number;
  UnitPrice?: number;
  unitPrice?: number;
  ProductId?: string;
  productId?: string;
  ModifierGroups?: TBBasketModifierGroup[];
  modifierGroups?: TBBasketModifierGroup[];
}

export interface TBBasketResponse {
  BasketId: string;
  Currency?: string;
  RestaurantSeoName?: string;
  RestaurantId?: string;
  MenuGroupId?: string;
  ServiceType?: string;
  BasketSummary?: {
    Products?: TBBasketSummaryProduct[];
  };
}

export interface TBCheckoutProductOption {
  name: string;
  quantity: number;
}

export interface TBCheckoutProduct {
  id: string;
  name: string;
  quantity: number;
  price: {
    amount: number;
    formattedAmount?: string;
  };
  options?: TBCheckoutProductOption[];
}

export interface TBCheckoutResponse {
  restaurant: {
    id: string;
    name: string;
    seoName: string;
    location?: {
      address?: {
        lines?: string[];
        locality?: string;
        postalCode?: string;
      };
      geolocation?: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
  purchase: {
    groups: Array<{
      products: TBCheckoutProduct[];
    }>;
  };
}

export interface TBSavedAddress {
  AddressId: number | string;
  City?: string;
  ZipCode?: string;
  AddressName?: string;
  Line1?: string;
}

export interface TBSavedAddressesResponse {
  Addresses: TBSavedAddress[];
  DefaultAddress?: number | string;
}

export interface TBWalletPaymentMethod {
  id?: string | number;
  paymentMethodId?: string | number;
  type?: string;
  paymentMethodType?: string;
  brand?: string;
  label?: string;
  name?: string;
  maskedPan?: string;
  lastFourDigits?: string;
  isDefault?: boolean;
  default?: boolean;
}

export interface TBWalletResponse {
  data: TBWalletPaymentMethod[];
}
