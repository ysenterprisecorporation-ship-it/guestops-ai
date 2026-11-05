import {
  DailyPriceUpdate,
  PmsAdapter,
  PmsBooking,
  PmsCapabilities,
  PmsMessage,
  PmsWebhookEvent,
} from "./PmsAdapter";

export class MockPmsAdapter implements PmsAdapter {
  readonly provider = "mock" as const;
  readonly sent: { bookingId: string; body: string }[] = [];
  readonly priceUpdates: DailyPriceUpdate[] = [];

  constructor(
    private readonly bookings: PmsBooking[] = [],
    private readonly messages: PmsMessage[] = [],
  ) {}

  capabilities(): PmsCapabilities {
    return {
      reservationsRead: true,
      reservationsWrite: true,
      messagesRead: true,
      messagesWrite: true,
      pricesRead: true,
      pricesWrite: true,
      webhooks: true,
    };
  }

  getBooking(id: string): PmsBooking | null {
    return this.bookings.find((booking) => booking.id === id) ?? null;
  }

  getMessages(bookingId: string): PmsMessage[] {
    return this.messages.filter((message) => message.bookingId === bookingId);
  }

  sendMessage(bookingId: string, body: string): void {
    this.sent.push({ bookingId, body });
  }

  updateDailyPrices(updates: DailyPriceUpdate[]): void {
    this.priceUpdates.push(...updates);
  }

  normalizeWebhook(payload: unknown): PmsWebhookEvent {
    const object =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const bookingId =
      typeof object.bookingId === "string" ? object.bookingId : undefined;
    return {
      provider: this.provider,
      eventType: bookingId ? "booking.updated" : "unknown",
      bookingId,
      raw: payload,
    };
  }
}
