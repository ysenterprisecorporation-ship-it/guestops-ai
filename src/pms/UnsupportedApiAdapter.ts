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

  getBooking(_id: string): PmsBooking | null {
    throw new PmsUnsupportedError(this.provider, "getBooking");
  }
  getMessages(_bookingId: string): PmsMessage[] {
    throw new PmsUnsupportedError(this.provider, "getMessages");
  }
  sendMessage(_bookingId: string, _body: string): void {
    throw new PmsUnsupportedError(this.provider, "sendMessage");
  }
  updateDailyPrices(_updates: DailyPriceUpdate[]): void {
    throw new PmsUnsupportedError(this.provider, "updateDailyPrices");
  }
  normalizeWebhook(payload: unknown): PmsWebhookEvent {
    return { provider: this.provider, eventType: "unknown", raw: payload };
  }
}
