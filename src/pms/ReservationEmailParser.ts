export interface ReservationEmail {
  provider: "booking.com" | "airhost" | "unknown";
  eventType: "BOOKING_NEW" | "BOOKING_CANCELLED" | "BOOKING_CHANGE" | "GUEST_MESSAGE" | "UNKNOWN";
  reservationCode?: string;
  guestCount?: number;
  arrival?: string;
  departure?: string;
  property?: string;
  status: "NEW" | "CHANGE" | "CANCELLED" | "MESSAGE" | "UNVERIFIED";
  sourceMessageId: string;
  evidence: string[];
}

const numericDateRe = /(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/;
const japaneseDateRe = /(20\d{2})年(\d{1,2})月(\d{1,2})日/;
function dateOf(line: string): string | undefined {
  const match = numericDateRe.exec(line) ?? japaneseDateRe.exec(line);
  if (!match) return undefined;
  const date = [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join("-");
  const parsed = new Date(date + "T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date
    ? date : undefined;
}
function dateFollowing(text: string, labels: string[]): string | undefined {
  const lines = text.split(/\r?\n/).map(line => line.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!labels.some(label => lines[i].toLowerCase().startsWith(label.toLowerCase()))) continue;
    const direct = dateOf(lines[i]);
    if (direct) return direct;
    if (i + 1 < lines.length) {
      const following = dateOf(lines[i + 1]);
      if (following) return following;
    }
  }
  return undefined;
}
function detectEvent(subject: string): ReservationEmail["eventType"] {
  if (/予約のキャンセル|予約がキャンセル|cancellation|reservation cancelled/i.test(subject))
    return "BOOKING_CANCELLED";
  if (/新しい予約|新規予約|booking confirmation|new reservation/i.test(subject))
    return "BOOKING_NEW";
  if (/予約の変更|予約内容.*変更|reservation modified|booking modified/i.test(subject))
    return "BOOKING_CHANGE";
  if (/メッセージが届きました|新着メッセージ|new message|guest message/i.test(subject))
    return "GUEST_MESSAGE";
  return "UNKNOWN";
}
function codeFromSubject(subject: string): string | undefined {
  const match = subject.match(/\((\d{10})(?:,|\))/);
  return match?.[1];
}
function codeFromMessage(body: string): string | undefined {
  // Booking.com messaging emails contain multiple links containing res_id; ignore them.
  return body.match(/予約番号\s*[:：]\s*\[?(\d{10})/)?.[1];
}
export function parseReservationEmail(message: {
  id: string; from: string; subject: string; body: string;
}): ReservationEmail {
  const from = message.from.toLowerCase();
  // Sender string is NOT a cryptographic proof; SMTP authentication must be verified separately.
  const provider = /@(?:[\w-]+\.)*booking\.com\b/.test(from) ? "booking.com"
    : /@(?:[\w-]+\.)*airhost\.[\w.-]+\b/.test(from) ? "airhost" : "unknown";
  const eventType = detectEvent(message.subject);
  const reservationCode = codeFromSubject(message.subject) ??
    (eventType === "GUEST_MESSAGE" ? codeFromMessage(message.body) : undefined);
  const arrival = dateFollowing(message.body, ["チェックイン", "check-in", "arrival"]);
  const departure = dateFollowing(message.body, ["チェックアウト", "check-out", "departure"]);
  const count = message.body.match(/^(?:宿泊人数|人数|guests|number of guests)\s*[:：]\s*(\d{1,2})/im);
  const guestCount = count ? Number(count[1]) : undefined;
  const evidence: string[] = [];
  if (provider === "unknown") evidence.push("UNVERIFIED_SENDER_DOMAIN");
  if (!reservationCode) evidence.push("RESERVATION_CODE_MISSING");
  if (eventType === "UNKNOWN") evidence.push("UNKNOWN_NOTIFICATION_TYPE");
  if (!arrival || !departure || departure <= arrival)
    evidence.push("DATES_REQUIRE_BOOKING_LOOKUP");
  if (!guestCount || guestCount > 9) evidence.push("GUEST_COUNT_REQUIRE_BOOKING_LOOKUP");
  if (eventType === "BOOKING_CANCELLED")
    evidence.push("CANCELLATION_REQUIRES_PMS_CONFIRMATION");
  if (eventType === "GUEST_MESSAGE")
    evidence.push("GUEST_MESSAGE_NOT_A_NEW_BOOKING");
  const status = eventType === "BOOKING_CANCELLED" ? "CANCELLED"
    : eventType === "BOOKING_CHANGE" ? "CHANGE"
    : eventType === "GUEST_MESSAGE" ? "MESSAGE"
    : eventType === "BOOKING_NEW" && provider !== "unknown" && !!reservationCode ? "NEW"
    : "UNVERIFIED";
  return { provider, eventType, reservationCode, arrival, departure,
    guestCount, status, sourceMessageId: message.id, evidence };
}
