// Squareレスポンスの利用部分のみ型付けする。
export interface Money {
  amount: number;
  currency: string;
}
export interface Payment {
  id: string;
  status: string;
  order_id?: string;
  location_id: string;
  amount_money: Money;
  tip_money?: Money;
  // Square reports partial/full refunds separately from COMPLETED payment status.
  refunded_money?: Money;
  buyer_email_address?: string;
}
export interface Order {
  id: string;
  location_id: string;
  state: string;
  created_at: string;
  total_money: Money;
  line_items?: {
    catalog_object_id?: string;
    quantity: string;
    base_price_money?: Money;
  }[];
}
export interface OrderRecord {
  date: string;
  orderId: string;
  email: string;
  product: string;
  amount: number;
  url: string;
  status: string;
}
export interface Job {
  paymentId: string;
  attempts: number;
  nextAt: number;
  state: "PENDING" | "DONE" | "FAILED";
  notified: boolean;
  noticeAt?: number;
}
export class BusinessError extends Error {}
export class RetryError extends Error {}
