import type {
  Restaurant, RestaurantWithMenu, MenuCategory, MenuItem,
  Cart, CartItem, CartItemOption, Order, OrderStatus, PaymentMethod,
} from '@orderfood/shared';
import type {
  UEStoreCard, UEStoreResponse, UECatalogGrid, UEDraftOrder,
  UEActiveOrder, UEPaymentProfile, UEMenuItemResponse,
} from './types.js';

export function mapStore(s: UEStoreCard): Restaurant {
  const etaMin = parseEtaMin(s.etaRange?.text);
  const deliveryFee = parseDeliveryFee(s.fareInfo?.displayString);
  return {
    id: s.uuid,
    platform: 'ubereats',
    name: s.title.text,
    cuisine: s.cuisineList?.cuisines.map(c => c.name) ?? [],
    rating: parseFloat(s.rating?.text ?? '0') || 0,
    delivery_time_min: etaMin,
    delivery_fee: deliveryFee,
    min_order: 0,
    image_url: undefined,
  };
}

export function mapRestaurantWithMenu(s: UEStoreResponse): RestaurantWithMenu {
  const categories: MenuCategory[] = [];

  for (const [sectionUuid, entries] of Object.entries(s.catalogSectionsMap)) {
    const sectionMeta = s.sections.find(sec => sec.uuid === sectionUuid);
    const sectionName = sectionMeta?.title ?? sectionUuid;

    const items: MenuItem[] = [];
    for (const entry of entries) {
      const grid = entry as UECatalogGrid;
      if (!grid.payload?.standardItemsPayload?.catalogItems) continue;
      for (const ci of grid.payload.standardItemsPayload.catalogItems) {
        items.push({
          id: ci.uuid,
          name: ci.title,
          description: ci.itemDescription,
          price: ci.price,
          category: sectionName,
          option_groups: [],   // populated lazily via getMenuItemV1
          image_url: ci.imageUrl,
        });
      }
    }
    if (items.length > 0) {
      categories.push({ name: sectionName, items });
    }
  }

  const etaMin = parseEtaMin(s.etaRange?.text);
  const deliveryFee = parseDeliveryFee(s.fareInfo?.displayString);
  return {
    id: s.uuid,
    platform: 'ubereats',
    name: s.title,
    cuisine: s.cuisineList?.cuisines.map(c => c.name) ?? [],
    rating: parseFloat(s.rating?.text ?? '0') || 0,
    delivery_time_min: etaMin,
    delivery_fee: deliveryFee,
    min_order: 0,
    image_url: s.heroImageUrls?.[0]?.url,
    categories,
  };
}

export function mapMenuItem(item: UEMenuItemResponse): MenuItem {
  return {
    id: item.uuid,
    name: item.title,
    description: item.itemDescription,
    price: item.price,
    category: '',
    image_url: item.imageUrl,
    option_groups: (item.customizationGroups ?? []).map(g => ({
      id: g.uuid,
      name: g.title,
      required: g.minPermitted > 0,
      min_selections: g.minPermitted,
      max_selections: g.maxPermitted,
      options: g.options.map(o => ({
        id: o.uuid,
        name: o.title,
        price_delta: o.price,
      })),
    })),
  };
}

export function mapCart(draftOrder: UEDraftOrder): Cart {
  const items: CartItem[] = draftOrder.shoppingCart.items.map(i => ({
    item_id: i.uuid,
    name: i.title,
    quantity: i.quantity,
    unit_price: i.price,
    selected_options: flattenCustomizations(i.customizations),
  }));
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  return {
    restaurant_id: draftOrder.storeUuid,
    platform: 'ubereats',
    items,
    subtotal,
    delivery_fee: 0,   // not available without getCheckoutPresentationV1
    total: subtotal,
  };
}

export function mapActiveOrder(o: UEActiveOrder): Order {
  return {
    id: o.uuid,
    platform: 'ubereats',
    status: mapOrderStatus(o.status),
    restaurant_name: o.storeInfo?.title ?? 'Unknown',
    items: [],
    total: o.total?.price?.amount ?? 0,
    placed_at: o.scheduledAt ?? new Date().toISOString(),
    estimated_delivery: o.estimatedDeliveryTime,
  };
}

export function mapPaymentProfile(p: UEPaymentProfile): PaymentMethod {
  return {
    id: p.uuid,
    type: guessPaymentType(p.tokenDisplayName ?? p.accountName),
    label: p.tokenDisplayName ?? p.accountName,
    is_default: false,   // caller sets is_default based on profile defaultPaymentProfileUuid
  };
}

// --- helpers ---

function parseEtaMin(text?: string): number {
  if (!text) return 0;
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDeliveryFee(text?: string): number {
  if (!text) return 0;
  const m = text.match(/[\d,.]+/);
  if (!m) return 0;
  return Math.round(parseFloat(m[0].replace(',', '.')) * 100);
}

function mapOrderStatus(s?: string): OrderStatus {
  switch (s?.toUpperCase()) {
    case 'PENDING': return 'pending';
    case 'ACCEPTED': case 'CONFIRMED': return 'confirmed';
    case 'STARTED': case 'PREPARING': case 'IN_PROGRESS': return 'preparing';
    case 'PICKED_UP': case 'DRIVER_EN_ROUTE': return 'picked_up';
    case 'COMPLETED': case 'DELIVERED': return 'delivered';
    case 'CANCELLED': case 'CANCELED': return 'cancelled';
    default: return 'pending';
  }
}

function guessPaymentType(name: string): PaymentMethod['type'] {
  const n = name.toLowerCase();
  if (n.includes('ideal')) return 'ideal';
  if (n.includes('paypal')) return 'paypal';
  if (n.includes('cash')) return 'cash';
  if (n.match(/visa|mastercard|amex|card/)) return 'card';
  return 'other';
}

function flattenCustomizations(
  customizations: Record<string, { uuid: string }[]>,
): CartItemOption[] {
  const options: CartItemOption[] = [];
  for (const [key, entries] of Object.entries(customizations)) {
    // key format: "{groupUuid}+{index}" or "{groupUuid}+{index},{optionUuid},{subGroupUuid}+{index}"
    // Extract the groupUuid from the first segment before "+"
    const groupUuid = key.split('+')[0];
    for (const entry of entries) {
      options.push({ group_id: groupUuid, option_id: entry.uuid });
    }
  }
  return options;
}
