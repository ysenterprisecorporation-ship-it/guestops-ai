import type { BookingRecord } from "./booking-flow.js";

export interface GmoManualPacket {
  bookingId: string;
  contractFileName: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  operatorChecklist: string[];
  status: "READY_FOR_GMO_MANUAL_SEND";
}

export interface MonthlyContractInput {
  recipientEmail: string;
  recipientName: string;
  contractFileName: string;
}

export function buildGmoManualPacket(record: BookingRecord, input: MonthlyContractInput): GmoManualPacket {
  if (record.rentalMode !== "MONTHLY") throw new Error("GMO_MANUAL_PACKET_MONTHLY_ONLY");
  if (record.state !== "BOOKING_CONFIRMED") throw new Error("BOOKING_MUST_BE_CONFIRMED");
  if (!record.reservationId) throw new Error("RESERVATION_ID_REQUIRED");
  if (!input.recipientEmail.includes("@")) throw new Error("RECIPIENT_EMAIL_INVALID");
  if (!input.recipientName.trim()) throw new Error("RECIPIENT_NAME_REQUIRED");
  if (!input.contractFileName.toLowerCase().endsWith(".pdf")) throw new Error("CONTRACT_PDF_REQUIRED");

  return {
    bookingId: record.bookingId,
    contractFileName: input.contractFileName,
    recipientEmail: input.recipientEmail.trim(),
    recipientName: input.recipientName.trim(),
    subject: `【電子契約】マンスリー利用契約 ${record.bookingId}`,
    operatorChecklist: [
      "GMOサイン無料アカウントへログイン",
      "契約PDFをアップロード",
      "宛先氏名・メールアドレスを転記",
      "署名位置を確認",
      "送信",
      "送信済みを予約台帳へ記録",
      "署名完了後に契約済みを予約台帳へ記録",
    ],
    status: "READY_FOR_GMO_MANUAL_SEND",
  };
}
