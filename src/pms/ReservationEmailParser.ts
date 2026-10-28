export interface ReservationEmail {
  provider: "booking.com" | "airhost" | "unknown";
  reservationCode?: string;
  guestCount?: number;
  arrival?: string;
  departure?: string;
  property?: string;
  status: "NEW" | "CHANGE" | "CANCELLED" | "UNVERIFIED";
  sourceMessageId: string;
  evidence: string[];
}

const dateRe = /(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/;
function dateOf(line: string): string | undefined {
  const m = dateRe.exec(line);
  if (!m) return undefined;
  const date = [m[1],m[2].padStart(2,"0"),m[3].padStart(2,"0")].join("-");
  const d = new Date(date+"T00:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===date ? date : undefined;
}
function field(text: string, words: string[]): string | undefined {
  return text.split(/\r?\n/).map(x=>x.trim()).find(line =>
    words.some(w => line.toLowerCase().startsWith(w.toLowerCase())));
}

export function parseReservationEmail(message: {
  id: string; from: string; subject: string; body: string;
}): ReservationEmail {
  const from = message.from.toLowerCase();
  // Identity check on sender is an aid, NOT email authentication.
  const provider = /@(?:[\w-]+\.)*booking\.com\b/.test(from) ? "booking.com"
    : /@(?:[\w-]+\.)*airhost\.[\w.-]+\b/.test(from) ? "airhost" : "unknown";
  const content = message.subject + "\n" + message.body;
  const codeMatches = [...content.matchAll(/(?<!\d)\d{10}(?!\d)/g)];
  const codes = [...new Set(codeMatches.map(m=>m[0]))];
  const reservationCode = codes.length===1 ? codes[0] : undefined;
  const arrival = dateOf(field(message.body, ["チェックイン", "check-in", "arrival"]) ?? "");
  const departure = dateOf(field(message.body, ["チェックアウト", "check-out", "departure"]) ?? "");
  const countLine = field(message.body, ["宿泊人数", "人数", "guests", "number of guests"]);
  const countMatch = countLine?.match(/(?:[:：]\s*)(\d{1,2})\b/);
  const guestCount = countMatch ? Number(countMatch[1]) : undefined;
  const cancelled = /cancelled|canceled|キャンセル|取消/.test(content.toLowerCase());
  const changed = /modified|変更|更新/.test(content.toLowerCase());
  const evidence:string[] = [];
  if(provider==="unknown") evidence.push("UNVERIFIED_SENDER_DOMAIN");
  if(!reservationCode) evidence.push("RESERVATION_CODE_AMBIGUOUS_OR_MISSING");
  if(!arrival || !departure || departure<=arrival) evidence.push("DATES_UNVERIFIED");
  if(!guestCount || guestCount>9) evidence.push("GUEST_COUNT_UNVERIFIED");
  if(cancelled) evidence.push("CANCELLATION_REQUIRES_PMS_CONFIRMATION");
  return {provider,reservationCode,arrival,departure,guestCount,
    status: cancelled?"CANCELLED":changed?"CHANGE":evidence.length?"UNVERIFIED":"NEW",
    sourceMessageId:message.id,evidence};
}
