export type Platform = 'ubereats' | 'thuisbezorgd';

// --- Restaurants & Menus ---

export interface Restaurant {
  id: string;
  platform: Platform;
  name: string;
  cuisine: string[];
  rating: number;
  delivery_time_min: number;
  delivery_fee: number;   // cents
  min_order: number;      // cents
  image_url?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  price_delta: number;   // cents; 0 = free
}

export interface MenuOptionGroup {
  id: string;
  name: string;           // e.g. "Choose your size"
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;          // base price in cents
  category: string;
  option_groups: MenuOptionGroup[];
  image_url?: string;
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface RestaurantWithMenu extends Restaurant {
  categories: MenuCategory[];
}

// --- Cart ---

export interface CartItemOption {
  group_id: string;
  option_id: string;
}

export interface CartItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;             // cents
  selected_options: CartItemOption[];
}

export interface Cart {
  restaurant_id: string;
  platform: Platform;
  items: CartItem[];
  subtotal: number;               // cents
  delivery_fee: number;           // cents
  total: number;                  // cents
}

// --- Orders ---

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  platform: Platform;
  status: OrderStatus;
  restaurant_name: string;
  items: CartItem[];
  total: number;                  // cents
  placed_at: string;              // ISO 8601
  estimated_delivery?: string;    // ISO 8601
}

// --- Account ---

export interface Address {
  id: string;
  label?: string;
  formatted: string;
  lat?: number;
  lng?: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'ideal' | 'cash' | 'other';
  label: string;                  // e.g. "Visa •••• 4242"
  is_default: boolean;
}

// --- Client contract ---

export interface SearchParams {
  location: string;
  cuisine?: string;
  query?: string;
  sort_by?: 'rating' | 'delivery_time' | 'delivery_fee';
}

export interface PlatformClient {
  searchRestaurants(params: SearchParams): Promise<Restaurant[]>;
  getRestaurant(restaurantId: string): Promise<RestaurantWithMenu>;
  getCart(): Promise<Cart | null>;
  addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[],
  ): Promise<Cart>;
  clearCart(): Promise<void>;
  getSavedAddresses(): Promise<Address[]>;
  getPaymentMethods(): Promise<PaymentMethod[]>;
  placeOrder(addressId: string, paymentMethodId: string): Promise<Order>;
  trackOrder(orderId: string): Promise<{ status: OrderStatus; details: string }>;
  getOrderHistory(limit?: number): Promise<Order[]>;
  cancelOrder(orderId: string): Promise<void>;
}
