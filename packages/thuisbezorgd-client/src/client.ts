import type {
  PlatformClient,
  SearchParams,
  Restaurant,
  RestaurantWithMenu,
  Cart,
  CartItemOption,
  Order,
  OrderStatus,
  Address,
  PaymentMethod,
} from '@orderfood/shared';
import { NotFoundError } from '@orderfood/shared';

const NOT_IMPLEMENTED_MESSAGE =
  'Thuisbezorgd client not yet implemented — run capture first';

export class ThuisbezorgdClient implements PlatformClient {
  async searchRestaurants(params: SearchParams): Promise<Restaurant[]> {
    void params;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async getRestaurant(restaurantId: string): Promise<RestaurantWithMenu> {
    void restaurantId;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async getCart(): Promise<Cart | null> {
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async addToCart(
    restaurantId: string,
    itemId: string,
    quantity: number,
    options?: CartItemOption[],
  ): Promise<Cart> {
    void restaurantId;
    void itemId;
    void quantity;
    void options;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async clearCart(): Promise<void> {
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async getSavedAddresses(): Promise<Address[]> {
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async placeOrder(addressId: string, paymentMethodId: string): Promise<Order> {
    void addressId;
    void paymentMethodId;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async trackOrder(orderId: string): Promise<{ status: OrderStatus; details: string }> {
    void orderId;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async getOrderHistory(limit?: number): Promise<Order[]> {
    void limit;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }

  async cancelOrder(orderId: string): Promise<void> {
    void orderId;
    throw new NotFoundError(NOT_IMPLEMENTED_MESSAGE, 'NOT_IMPLEMENTED');
  }
}
