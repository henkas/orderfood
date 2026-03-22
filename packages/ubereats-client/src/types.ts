// Raw Uber Eats API response shapes

export interface UEApiResponse<T> {
  status: 'success' | 'failure';
  data: T;
}

// mapsSearchV1
export interface UEAddressSuggestion {
  id: string;
  provider: string;
  addressLine1: string;
  addressLine2: string;
  categories: string[];
}

// upsertDeliveryLocationV2
export interface UEDeliveryLocation {
  deliveryLocation: {
    location: {
      name: string;
      addressLine1: string;
      addressLine2: string;
      fullAddress: string;
      coordinate: { latitude: number; longitude: number };
      id: string;
    };
  };
}

// getFeedV1
export interface UEFeedItem {
  uuid: string;
  type: string;
  text?: string;
  actionUrl?: string;
}

export interface UEStoreCard {
  uuid: string;
  title: { text: string };
  rating?: { text: string; accessibilityText: string };
  etaRange?: { text: string };
  fareInfo?: { displayString: string };
  heroImageUrl?: string;
  cuisineList?: { cuisines: { uuid: string; name: string }[] };
}

export interface UEFeedResponse {
  feedItems: UEFeedItem[];
  storesMap: Record<string, UEStoreCard>;
}

// getStoreV1
export interface UECatalogItem {
  uuid: string;
  imageUrl?: string;
  title: string;
  itemDescription?: string;
  price: number;
  isSoldOut?: boolean;
  hasCustomizations?: boolean;
  sectionUuid?: string;
  subsectionUuid?: string;
}

export interface UECatalogGrid {
  type: 'VERTICAL_GRID' | 'HORIZONTAL_GRID';
  catalogSectionUUID: string;
  payload: {
    standardItemsPayload: {
      title?: { text: string };
      catalogItems: UECatalogItem[];
      sectionUUID: string;
    };
  };
}

export interface UESection {
  uuid: string;
  title: string;
  subtitle?: string;
  subsectionUuids: string[];
}

export interface UEStoreResponse {
  uuid: string;
  title: string;
  rating?: { text: string };
  etaRange?: { text: string };
  fareInfo?: { displayString: string };
  cuisineList?: { cuisines: { uuid: string; name: string }[] };
  heroImageUrls?: { url: string }[];
  sections: UESection[];
  catalogSectionsMap: Record<string, (UECatalogGrid | { type: string })[]>;
}

// getMenuItemV1
export interface UEMenuOption {
  uuid: string;
  title: string;
  price: number;
  defaultQuantity?: number;
}

export interface UEOptionGroup {
  uuid: string;
  title: string;
  minPermitted: number;
  maxPermitted: number;
  options: UEMenuOption[];
}

export interface UEMenuItemResponse {
  uuid: string;
  title: string;
  itemDescription?: string;
  price: number;
  imageUrl?: string;
  sectionUuid?: string;
  subsectionUuid?: string;
  customizationGroups?: UEOptionGroup[];
}

// Draft order / cart
export interface UEShoppingCartItem {
  uuid: string;
  shoppingCartItemUuid: string;
  storeUuid: string;
  sectionUuid: string;
  subsectionUuid: string;
  price: number;
  title: string;
  quantity: number;
  customizations: Record<string, UECustomizationEntry[]>;
}

export interface UECustomizationEntry {
  uuid: string;
  price: number;
  quantity: number;
  title: string;
  defaultQuantity?: number;
  customizationMeta?: { title: string; isPickOne?: boolean };
}

export interface UEDraftOrder {
  uuid: string;
  storeUuid: string;
  shoppingCart: {
    cartUuid: string;
    storeUuid: string;
    items: (UEShoppingCartItem & { consumerUuid: string; specialInstructions: string })[];
  };
}

// Payment profiles
export interface UEPaymentProfile {
  uuid: string;
  accountName: string;
  status: string;
  tokenType: string;
  tokenDisplayName?: string;
  hasBalance?: boolean;
}

// Active orders
export interface UEActiveOrder {
  uuid: string;
  storeInfo?: { title?: string };
  status?: string;
  scheduledAt?: string;
  estimatedDeliveryTime?: string;
  total?: { price?: { amount: number } };
}
