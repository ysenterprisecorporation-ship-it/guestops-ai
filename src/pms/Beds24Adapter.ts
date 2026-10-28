import {
  DailyPriceUpdate,
  PmsAdapter,
  PmsBooking,
  PmsCapabilities,
  PmsConfigurationError,
  PmsMessage,
  PmsWebhookEvent,
} from "./PmsAdapter";
import {
  PmsHttpClient,
  parseJson,
  require2xx,
} from "./PmsHttpClient";

interface Beds24Config {
  token: string;
  baseUrl?: string;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asObject(value);
  if (Array.isArray(object.data)) return object.data;
  if (Array.isArray(object.bookings)) return object.bookings;
  if (Array.isArray(object.messages)) return object.messages;
  return [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export class Beds24Adapter implements PmsAdapter {
  readonly provider = "beds24" as const;
  private readonly baseUrl: string;

  constructor(
    private readonly config: Beds24Config,
    private readonly http: PmsHttpClient,
  ) {
    if (!config.token.trim())
      throw new PmsConfigurationError("BEDS24_TOKEN_MISSING");
    this.baseUrl = (config.baseUrl ?? "https://api.beds24.com/v2").replace(/\/$/, "");
  }

  capabilities(): PmsCapabilities {
    return {
      reservationsRead: true,
      reservationsWrite: false,
      messagesRead: true,
      messagesWrite: false,
      pricesRead: false,
      pricesWrite: false,
      webhooks: true,
    };
  }

  getBooking(id: string): PmsBooking | null {
    const response = this.http.request(
      "GET",
      `${this.baseUrl}/bookings?id=${encodeURIComponent(id)}`,
      this.headers(),
    );
    require2xx(response.status, response.body);
    const parsed = parseJson<unknown>(response.body);\n    if (!Array.isArray(parsed) && !Array.isArray(asObject(parsed).data))\n      throw new Error("PMS_BOOKING_RESPONSE_UNVERIFIED");\n    const rows = asArray(parsed);
    if (rows.length === 0) return null;
    return this.mapBooking(rows[0]);
  }

  getMessages(bookingId: string): PmsMessage[] {
    const response = this.http.request(
      "GET",
      `${this.baseUrl}/bookings/messages?bookingId=${encodeURIComponent(bookingId)}`,
      this.headers(),
    );
    require2xx(response.status, response.body);
    const parsed = parseJson<unknown>(response.body);\n    if (!Array.isArray(parsed) && !Array.isArray(asObject(parsed).data))\n      throw new Error("PMS_MESSAGE_RESPONSE_UNVERIFIED");\n    return asArray(parsed).map((row, index) =>
      this.mapMessage(row, bookingId, index),
    );
  }

  sendMessage(bookingId: string, body: string): void {
    void bookingId;
    void body;
    throw new Error("PMS_MESSAGE_WRITE_DISABLED_UNVERIFIED_CONTRACT");
  }

  updateDailyPrices(updates: DailyPriceUpdate[]): void {
    void updates;
    throw new Error("PMS_PRICE_WRITE_DISABLED_UNVERIFIED_CONTRACT_AND_FLOOR");
  }

  normalizeWebhook(payload: unknown): PmsWebhookEvent {
    const object = asObject(payload);
    const booking = asObject(object.booking);
    const bookingId =
      asString(object.bookingId) ??
      asString(object.booking_id) ??
      asString(object.id) ??
      asString(booking.id);
    const status = (
      asString(object.status) ??
      asString(booking.status) ??
      ""
    ).toLowerCase();
    const action = (
      asString(object.action) ??
      asString(object.event) ??
      asString(object.type) ??
      ""
    ).toLowerCase();

    let eventType: PmsWebhookEvent["eventType"] = "unknown";
    if (action.includes("message")) eventType = "booking.message";
    else if (status.includes("cancel") || action.includes("cancel"))
      eventType = "booking.cancelled";
    else if (action.includes("new") || action.includes("create"))
      eventType = "booking.created";
    else if (bookingId) eventType = "booking.updated";

    return { provider: this.provider, eventType, bookingId, raw: payload };
  }

  private headers(): Record<string, string> {
    return {
      token: this.config.token,
      accept: "application/json",
      "content-type": "application/json",
    };
  }

  private mapBooking(value: unknown): PmsBooking {
    const row = asObject(value);
    const guest = asObject(row.guest);
    const id = asString(row.id) ?? asString(row.bookingId);
    if (!id) throw new Error("PMS_BOOKING_ID_MISSING");
    return {
      id,
      propertyId: asString(row.propertyId),
      roomId: asString(row.roomId),
      channel: asString(row.channel) ?? asString(row.referer),
      status: asString(row.status),
      arrival: asString(row.arrival) ?? asString(row.checkIn),
      departure: asString(row.departure) ?? asString(row.checkOut),
      adults: asNumber(row.numAdult) ?? asNumber(row.adults),
      children: asNumber(row.numChild) ?? asNumber(row.children),
      price: asNumber(row.price),
      currency: asString(row.currency),
      guest: {
        id: asString(guest.id),
        firstName: asString(row.firstName) ?? asString(guest.firstName),
        lastName: asString(row.lastName) ?? asString(guest.lastName),
        email: asString(row.email) ?? asString(guest.email),
        phone: asString(row.phone) ?? asString(guest.phone),
      },
      raw: value,
    };
  }

  private mapMessage(
    value: unknown,
    bookingId: string,
    index: number,
  ): PmsMessage {
    const row = asObject(value);
    const id =
      asString(row.id) ??
      asString(row.messageId) ??
      `${bookingId}:${index}`;
    const body =
      asString(row.message) ??
      asString(row.body) ??
      asString(row.text) ??
      "";
    const directionRaw = (asString(row.direction) ?? "").toLowerCase();
    const direction =
      directionRaw === "in" || directionRaw === "inbound"
        ? ("inbound" as const)
        : directionRaw === "out" || directionRaw === "outbound"
          ? ("outbound" as const)
          : undefined;
    return {
      id,
      bookingId: asString(row.bookingId) ?? bookingId,
      body,
      direction,
      createdAt: asString(row.createdAt) ?? asString(row.time),
      read: typeof row.read === "boolean" ? row.read : undefined,
      raw: value,
    };
  }
}
