export type PmsProvider = "beds24" | "airhost" | "lodgify" | "mock";

export interface PmsCapabilities {
  reservationsRead: boolean;
  reservationsWrite: boolean;
  messagesRead: boolean;
  messagesWrite: boolean;
  pricesRead: boolean;
  pricesWrite: boolean;
  webhooks: boolean;
}

export interface PmsGuest {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface PmsBooking {
  id: string;
  propertyId?: string;
  roomId?: string;
  channel?: string;
  status?: string;
  arrival?: string;
  departure?: string;
  adults?: number;
  children?: number;
  price?: number;
  currency?: string;
  guest?: PmsGuest;
  raw?: unknown;
}

export interface PmsMessage {
  id: string;
  bookingId: string;
  direction?: "inbound" | "outbound";
  body: string;
  createdAt?: string;
  read?: boolean;
  raw?: unknown;
}

export interface DailyPriceUpdate {
  propertyId: string;
  roomId: string;
  date: string;
  price: number;
  minStay?: number;
  available?: number;
}

export interface PmsWebhookEvent {
  provider: PmsProvider;
  eventType: "booking.created" | "booking.updated" | "booking.cancelled" | "booking.message" | "unknown";
  bookingId?: string;
  raw: unknown;
}

export interface PmsAdapter {
  readonly provider: PmsProvider;
  capabilities(): PmsCapabilities;
  getBooking(id: string): PmsBooking | null;
  getMessages(bookingId: string): PmsMessage[];
  sendMessage(bookingId: string, body: string): void;
  updateDailyPrices(updates: DailyPriceUpdate[]): void;
  normalizeWebhook(payload: unknown): PmsWebhookEvent;
}

export class PmsUnsupportedError extends Error {
  constructor(provider: string, operation: string) {
    super(`PMS_UNSUPPORTED:${provider}:${operation}`);
    this.name = "PmsUnsupportedError";
  }
}

export class PmsConfigurationError extends Error {
  constructor(message: string) {
    super(`PMS_CONFIGURATION:${message}`);
    this.name = "PmsConfigurationError";
  }
}
