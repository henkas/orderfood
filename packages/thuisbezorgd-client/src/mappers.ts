import type {
  Address,
  Cart,
  CartItemOption,
  MenuCategory,
  MenuItem,
  MenuOptionGroup,
  PaymentMethod,
  Restaurant,
  RestaurantWithMenu,
} from '@orderfood/shared';
import type {
  TBBasketResponse,
  TBCheckoutResponse,
  TBListingRestaurant,
  TBMenuCategory,
  TBMenuItem,
  TBModifierGroup,
  TBModifierSet,
  TBRestaurantCdnData,
  TBSavedAddressesResponse,
  TBWalletResponse,
} from './types.js';

export function mapRestaurantSummary(
  restaurant: TBListingRestaurant,
): Restaurant {
  return {
    id: restaurant.uniqueName,
    platform: 'thuisbezorgd',
    name: restaurant.name,
    cuisine: restaurant.cuisines?.map((cuisine) => cuisine.name) ?? [],
    rating: restaurant.rating?.starRating ?? 0,
    delivery_time_min: restaurant.deliveryEtaMinutes?.rangeLower ?? 0,
    delivery_fee:
      restaurant.deliveryFees?.byMinFee?.fee ??
      restaurant.deliveryFees?.byMaxFee?.fee ??
      0,
    min_order:
      restaurant.deliveryFees?.byMinFee?.minimumAmount ??
      restaurant.deliveryFees?.byMaxFee?.minimumAmount ??
      0,
    image_url: restaurant.logoUrl,
  };
}

export function mapRestaurantMenu(
  restaurant: TBRestaurantCdnData,
): RestaurantWithMenu {
  const modifierGroups = new Map(
    restaurant.modifierGroups.map((group) => [group.id, group]),
  );
  const modifierSets = new Map(
    restaurant.modifierSets.map((set) => [set.id, set]),
  );

  const categories: MenuCategory[] =
    restaurant.menus[0]?.categories
      ?.map((category) =>
        mapCategory(category, restaurant.items, modifierGroups, modifierSets),
      )
      .filter((category) => category.items.length > 0) ?? [];

  return {
    id: restaurant.restaurantInfo.seoName,
    platform: 'thuisbezorgd',
    name: restaurant.restaurantInfo.name,
    cuisine:
      restaurant.restaurantInfo.cuisineTypes?.map((cuisine) => cuisine.name) ??
      [],
    rating: 0,
    delivery_time_min: 0,
    delivery_fee: 0,
    min_order: 0,
    image_url:
      restaurant.restaurantInfo.bannerUrl ?? restaurant.restaurantInfo.logoUrl,
    categories,
  };
}

export function mapPaymentMethodStub(label: string): PaymentMethod {
  return {
    id: label,
    type: 'other',
    label,
    is_default: false,
  };
}

export function mapBasketSummary(
  basket: TBBasketResponse,
): Cart {
  const items = (basket.BasketSummary?.Products ?? []).map((product) => {
    const unitPrice = eurosToCents(
      product.UnitPrice ?? product.unitPrice ?? 0,
    );
    return {
      item_id: String(product.ProductId ?? product.productId ?? ''),
      name: product.Name ?? product.name ?? '',
      quantity: product.Quantity ?? product.quantity ?? 0,
      unit_price: unitPrice,
      selected_options: flattenBasketModifiers(product),
    };
  });

  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return {
    restaurant_id: basket.RestaurantSeoName ?? basket.RestaurantId ?? '',
    platform: 'thuisbezorgd',
    items,
    subtotal,
    delivery_fee: 0,
    total: subtotal,
  };
}

export function mapCheckoutCart(checkout: TBCheckoutResponse): Cart {
  const items = checkout.purchase.groups.flatMap((group) =>
    group.products.map((product) => ({
      item_id: product.id,
      name: product.name,
      quantity: product.quantity,
      unit_price: product.price.amount,
      selected_options: (product.options ?? []).map((option, index) => ({
        group_id: `checkout-option-${index}`,
        option_id: option.name,
      })),
    })),
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  return {
    restaurant_id: checkout.restaurant.seoName,
    platform: 'thuisbezorgd',
    items,
    subtotal,
    delivery_fee: 0,
    total: subtotal,
  };
}

export function mapSavedAddresses(
  response: TBSavedAddressesResponse,
): Address[] {
  return (response.Addresses ?? []).map((address) => ({
    id: String(address.AddressId),
    label: address.AddressName,
    formatted: [address.Line1, address.ZipCode, address.City]
      .filter(Boolean)
      .join(', '),
  }));
}

export function mapWalletPaymentMethods(
  response: TBWalletResponse,
): PaymentMethod[] {
  return (response.data ?? []).map((method) => {
    const label =
      method.label ??
      method.name ??
      method.brand ??
      method.maskedPan ??
      (method.lastFourDigits
        ? `Card •••• ${method.lastFourDigits}`
        : String(method.id ?? method.paymentMethodId ?? 'payment-method'));
    return {
      id: String(method.id ?? method.paymentMethodId ?? label),
      type: inferPaymentType(method),
      label,
      is_default: method.isDefault ?? method.default ?? false,
    };
  });
}

function mapCategory(
  category: TBMenuCategory,
  items: Record<string, TBMenuItem>,
  modifierGroups: Map<string, TBModifierGroup>,
  modifierSets: Map<string, TBModifierSet>,
): MenuCategory {
  return {
    name: category.name,
    items: category.itemIds
      .map((itemId) => items[itemId])
      .filter((item): item is TBMenuItem => Boolean(item))
      .map((item) =>
        mapMenuItem(item, category.name, modifierGroups, modifierSets),
      ),
  };
}

function mapMenuItem(
  item: TBMenuItem,
  categoryName: string,
  modifierGroups: Map<string, TBModifierGroup>,
  modifierSets: Map<string, TBModifierSet>,
): MenuItem {
  const primaryVariation = item.variations?.[0];
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: eurosToCents(primaryVariation?.basePrice ?? 0),
    category: categoryName,
    image_url: item.imageSources?.[0]?.path,
    option_groups: (primaryVariation?.modifierGroupsIds ?? [])
      .map((groupId) => modifierGroups.get(groupId))
      .filter((group): group is TBModifierGroup => Boolean(group))
      .map((group) => mapModifierGroup(group, modifierSets)),
  };
}

function mapModifierGroup(
  group: TBModifierGroup,
  modifierSets: Map<string, TBModifierSet>,
): MenuOptionGroup {
  return {
    id: group.id,
    name: group.name,
    required: group.minChoices > 0,
    min_selections: group.minChoices,
    max_selections: group.maxChoices,
    options: group.modifiers
      .map((modifierId) => modifierSets.get(modifierId))
      .filter((set): set is TBModifierSet => Boolean(set))
      .map((set) => ({
        id: set.modifier.id,
        name: set.modifier.name,
        price_delta: eurosToCents(set.modifier.additionPrice),
      })),
  };
}

function eurosToCents(value: number): number {
  return Math.round(value * 100);
}

function flattenBasketModifiers(
  product: TBBasketSummaryProductLike,
): CartItemOption[] {
  const groups = product.ModifierGroups ?? product.modifierGroups ?? [];
  return groups.flatMap((group) => {
    const normalizedGroup = group as {
      ModifierGroupId?: string;
      modifierGroupId?: string;
      Modifiers?: Array<{ ModifierId?: string; modifierId?: string }>;
      modifiers?: Array<{ ModifierId?: string; modifierId?: string }>;
    };
    const groupId = String(
      normalizedGroup.ModifierGroupId ?? normalizedGroup.modifierGroupId ?? '',
    );
    const modifiers =
      normalizedGroup.Modifiers ?? normalizedGroup.modifiers ?? [];
    return modifiers.map((modifier) => ({
      group_id: groupId,
      option_id: String(modifier.ModifierId ?? modifier.modifierId ?? ''),
    }));
  });
}

function inferPaymentType(method: {
  type?: string;
  paymentMethodType?: string;
  brand?: string;
  label?: string;
  name?: string;
}): PaymentMethod['type'] {
  const text = [
    method.type,
    method.paymentMethodType,
    method.brand,
    method.label,
    method.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('ideal')) return 'ideal';
  if (text.includes('paypal')) return 'paypal';
  if (text.includes('cash')) return 'cash';
  if (/(visa|mastercard|master card|amex|american express|card)/.test(text)) {
    return 'card';
  }
  return 'other';
}

type TBBasketSummaryProductLike = {
  ModifierGroups?: Array<{
    ModifierGroupId?: string;
    Modifiers?: Array<{ ModifierId?: string }>;
  }>;
  modifierGroups?: Array<{
    modifierGroupId?: string;
    modifiers?: Array<{ modifierId?: string }>;
  }>;
};
