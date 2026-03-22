import type {
  MenuCategory,
  MenuItem,
  MenuOptionGroup,
  PaymentMethod,
  Restaurant,
  RestaurantWithMenu,
} from '@orderfood/shared';
import type {
  TBListingRestaurant,
  TBMenuCategory,
  TBMenuItem,
  TBModifierGroup,
  TBModifierSet,
  TBRestaurantCdnData,
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
