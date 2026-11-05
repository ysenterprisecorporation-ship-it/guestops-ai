import {
  DailyPriceUpdate,
  PmsAdapter,
  PmsBooking,
  PmsCapabilities,
  PmsMessage,
  PmsProvider,
  PmsUnsupportedError,
  PmsWebhookEvent,
} from "./PmsAdapter";

export class UnsupportedApiAdapter implements PmsAdapter {
  constructor(
    readonly provider: Exclude<PmsProvider, "beds24" | "mock">,
    private readonly supported: Partial<PmsCapabilities> = {},
  ) {}

  capabilities(): PmsCapabilities {
    return {
      reservationsRead: false,
      reservationsWrite: false,
      messagesRead: false,
      messagesWrite: false,
      pricesRead: false,
      pricesWrite: false,
      webhooks: false,
      ...this.supported,
    };
  }

  getBooking(id: string): PmsBooking | null {
    void id;
    throw new PmsUnsupportedError(this.provider, "getBooking");
  }

  getMessages(bookingId: string): PmsMessage[] {
    void bookingId;
    throw new PmsUnsupportedError(this.provider, "getMessages");
  }

  sendMessage(bookingId: string, body: string): void {
    void bookingId;
    void body;
    throw new PmsUnsupportedError(this.provider, "sendMessage");
  }

  updateDailyPrices(updates: DailyPriceUpdate[]): void {
    void updates;
    throw new PmsUnsupportedError(this.provider, "updateDailyPrices");
  }

  normalizeWebhook(payload: unknown): PmsWebhookEvent {
    return { provider: this.provider, eventType: "unknown", raw: payload };
  }
}
