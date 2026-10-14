import type { LeadRecord, LeadStatus } from "./LeadPipeline";

export const LEAD_HEADERS = [
  "案件",
  "会社名",
  "公式URL",
  "公式窓口",
  "窓口種別",
  "適合度",
  "適合根拠",
  "配信リスク",
  "状態",
  "売上",
  "利益",
  "最終更新",
] as const;

function safeText(value: string): string {
  return /^[=+@\-]/.test(value) ? "'" + value : value;
}

export function leadToRow(lead: LeadRecord): (string | number | Date)[] {
  return [
    lead.project,
    safeText(lead.companyName),
    safeText(lead.sourceUrl),
    safeText(lead.officialContact ?? ""),
    lead.contactType ?? "other",
    lead.fitScore,
    safeText(lead.fitEvidence.join(" | ")),
    lead.deliveryRisk,
    lead.status,
    lead.revenueYen ?? 0,
    lead.profitYen ?? 0,
    lead.lastEventAt ? new Date(lead.lastEventAt) : new Date(0),
  ];
}

export function rowToLead(row: unknown[]): LeadRecord {
  return {
    project: String(row[0]) as LeadRecord["project"],
    companyName: String(row[1] ?? ""),
    sourceUrl: String(row[2] ?? ""),
    officialContact: String(row[3] ?? "") || undefined,
    contactType: (String(row[4] ?? "other") || "other") as LeadRecord["contactType"],
    fitScore: Number(row[5] ?? 0),
    fitEvidence: String(row[6] ?? "")
      .split(" | ")
      .map((v) => v.trim())
      .filter(Boolean),
    deliveryRisk: String(row[7] ?? "unknown") as LeadRecord["deliveryRisk"],
    status: String(row[8] ?? "new") as LeadStatus,
    revenueYen: Number(row[9] ?? 0),
    profitYen: Number(row[10] ?? 0),
    lastEventAt:
      row[11] instanceof Date
        ? row[11].toISOString()
        : String(row[11] ?? "") || undefined,
  };
}

export class LeadSheetService {
  constructor(readonly sheet: GoogleAppsScript.Spreadsheet.Sheet) {
    const actual = sheet.getRange(1, 1, 1, LEAD_HEADERS.length).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(LEAD_HEADERS)) {
      throw new Error("LEAD_SHEET_HEADER_MISMATCH");
    }
  }

  all(): LeadRecord[] {
    if (this.sheet.getLastRow() < 2) return [];
    return this.sheet
      .getRange(2, 1, this.sheet.getLastRow() - 1, LEAD_HEADERS.length)
      .getValues()
      .map(rowToLead);
  }

  append(lead: LeadRecord): void {
    this.sheet.appendRow(leadToRow(lead));
    SpreadsheetApp.flush();
  }

  updateStatus(rowNumber: number, status: LeadStatus, at = new Date()): void {
    this.sheet.getRange(rowNumber, 9).setValue(status);
    this.sheet.getRange(rowNumber, 12).setValue(at);
    SpreadsheetApp.flush();
  }
}
