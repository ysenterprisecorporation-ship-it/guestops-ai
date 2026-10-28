import { parseReservationEmail, ReservationEmail } from "./ReservationEmailParser";

export interface IncomingMail {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export interface MailReader {
  search(query: string, limit: number): IncomingMail[];
}

export interface MailReport {
  total: number;
  proposals: ReservationEmail[];
  rejectedCount: number;
}

export class GasGtosMailReader implements MailReader {
  search(query: string, limit: number): IncomingMail[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("GTOS_MAIL_LIMIT_INVALID");
    const threads = GmailApp.search(query, 0, limit);
    const result: IncomingMail[] = [];
    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        if (result.length >= limit) break;
        result.push({
          id: message.getId(),
          from: message.getFrom(),
          subject: message.getSubject(),
          body: message.getPlainBody().slice(0, 20000),
        });
      }
      if (result.length >= limit) break;
    }
    return result;
  }
}

// Read-only. Never trusts email alone as proof of booking or identity.
export function inspectReservationMailbox(
  mail: MailReader,
  query = 'newer_than:14d {from:(booking.com) from:(airhost)}',
  limit = 20,
): MailReport {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("GTOS_MAIL_LIMIT_INVALID");
  const records = mail.search(query, limit);
  const proposals = records.map(parseReservationEmail);
  return {
    total: proposals.length,
    proposals,
    rejectedCount: proposals.filter(p => p.evidence.length > 0).length,
  };
}

// Use only inside the separately authorized lodging GAS project, never Square's doPost.
export function gtosGmailReadOnlyProbe() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("GTOS_MAIL_READ_ENABLED") !== "true") throw new Error("GTOS_MAIL_READ_DISABLED");
  const report = inspectReservationMailbox(new GasGtosMailReader());
  // Privacy: export no raw bodies, guest names, email addresses, or ID documents.
  return {
    total: report.total,
    rejectedCount: report.rejectedCount,
    items: report.proposals.map(p => ({
      sourceMessageId: p.sourceMessageId,
      provider: p.provider,
      status: p.status,
      reservationCode: p.reservationCode,
      arrival: p.arrival,
      departure: p.departure,
      guestCount: p.guestCount,
      reasons: p.evidence,
    })),
  };
}
