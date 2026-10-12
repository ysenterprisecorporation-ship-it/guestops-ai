import { products } from "./Config";
import { deliveryUrl } from "./DriveService";
import {
  BusinessError,
  RetryError,
  type Payment,
  type Order,
  type OrderRecord,
} from "./Types";
// 通知本文ではなくSquare APIから再取得した決済と注文を照合する。
export function validateOrder(
  payment: Payment,
  order: Order,
  location: string,
): OrderRecord {
  if (
    payment.location_id !== location ||
    order.location_id !== location ||
    payment.order_id !== order.id
  )
    throw new BusinessError("ORDER_LOCATION_MISMATCH");
  if (payment.status !== "COMPLETED")
    throw new BusinessError("PAYMENT_NOT_COMPLETED");
  if (order.state === "OPEN") throw new RetryError("ORDER_NOT_YET_COMPLETED");
  if (order.state !== "COMPLETED")
    throw new BusinessError("ORDER_NOT_COMPLETED");
  const items = order.line_items ?? [];
  if (items.length !== 1 || items[0].quantity !== "1")
    throw new BusinessError("UNSUPPORTED_CART");
  const product = products().find(
    (p) => p.variation === items[0].catalog_object_id,
  );
  if (!product) throw new BusinessError("PRODUCT_UNKNOWN");
  if (
    [payment.amount_money, order.total_money, items[0].base_price_money].some(
      (m) => !m || m.currency !== "JPY" || m.amount !== product.price,
    ) ||
    (payment.tip_money?.amount ?? 0) !== 0
  )
    throw new BusinessError("PRICE_MISMATCH");
  const email = payment.buyer_email_address?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BusinessError("EMAIL_MISSING");
  if (!Number.isFinite(Date.parse(order.created_at)))
    throw new BusinessError("DATE_INVALID");
  return {
    date: order.created_at,
    orderId: order.id,
    email,
    product: product.key,
    amount: product.price,
    url: deliveryUrl(product.key),
    status: "RECORDED",
  };
}
export interface SquareReader {
  payment(id: string): Payment;
  order(id: string): Order;
}
export function getRecord(
  api: SquareReader,
  id: string,
  location: string,
): OrderRecord {
  const payment = api.payment(id);
  if (payment.id !== id) throw new BusinessError("PAYMENT_ID_MISMATCH");
  if (!payment.order_id) throw new BusinessError("ORDER_MISSING");
  return validateOrder(payment, api.order(payment.order_id), location);
}
