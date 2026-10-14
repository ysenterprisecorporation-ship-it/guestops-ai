import type { BookingRecord } from "../booking-flow.js";

export interface SquareConfig {
  accessToken: string;
  locationId: string;
  environment: "sandbox" | "production";
  apiVersion?: string;
}

export interface SquarePaymentStatus {
  paid: boolean;
  paymentId?: string;
  amountYen?: number;
  paidAtIso?: string;
}

function baseUrl(environment: SquareConfig["environment"]) {
  return environment === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function headers(config: SquareConfig) {
  return {
    "Authorization": `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
    "Square-Version": config.apiVersion ?? "2026-09-16",
  };
}

export class SquareAdapter {
  constructor(private readonly config: SquareConfig) {}

  async createPaymentLink(record: BookingRecord, key: string) {
    if (!Number.isSafeInteger(record.quoteAmountYen) || record.quoteAmountYen <= 0) {
      throw new Error("QUOTE_AMOUNT_INVALID");
    }

    const response = await fetch(`${baseUrl(this.config.environment)}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: headers(this.config),
      body: JSON.stringify({
        idempotency_key: key,
        description: `Group Trip OS ${record.bookingId}`,
        payment_note: `GTOS:${record.bookingId}`,
        quick_pay: {
          name: `Group Trip OS booking ${record.bookingId}`,
          price_money: {
            amount: record.quoteAmountYen,
            currency: "JPY",
          },
          location_id: this.config.locationId,
        },
      }),
    });

    const payload = await response.json() as {
      payment_link?: { id?: string; url?: string; order_id?: string };
      errors?: unknown;
    };

    if (!response.ok || !payload.payment_link?.id || !payload.payment_link.url) {
      throw new Error(`SQUARE_PAYMENT_LINK_FAILED:${response.status}:${JSON.stringify(payload.errors ?? payload)}`);
    }

    return {
      paymentLinkId: payload.payment_link.id,
      orderId: payload.payment_link.order_id,
      url: payload.payment_link.url,
    };
  }

  async listCompletedPaymentForBooking(
    record: BookingRecord,
    beginTimeIso: string,
  ): Promise<SquarePaymentStatus> {
    const url = new URL(`${baseUrl(this.config.environment)}/v2/payments`);
    url.searchParams.set("begin_time", beginTimeIso);
    url.searchParams.set("sort_order", "DESC");
    url.searchParams.set("limit", "100");

    const response = await fetch(url, {
      headers: headers(this.config),
    });

    const payload = await response.json() as {
      payments?: Array<{
        id?: string;
        status?: string;
        amount_money?: { amount?: number };
        created_at?: string;
        note?: string;
        order_id?: string;
      }>;
      errors?: unknown;
    };

    if (!response.ok) {
      throw new Error(`SQUARE_LIST_PAYMENTS_FAILED:${response.status}:${JSON.stringify(payload.errors ?? payload)}`);
    }

    const marker = `GTOS:${record.bookingId}`;
    const payment = payload.payments?.find((p) =>
      p.status === "COMPLETED" &&
      p.note === marker &&
      p.amount_money?.amount === record.quoteAmountYen,
    );

    if (!payment?.id || !payment.created_at) return { paid: false };

    return {
      paid: true,
      paymentId: payment.id,
      amountYen: payment.amount_money?.amount,
      paidAtIso: payment.created_at,
    };
  }
}
