import type { LeadRecord, LeadStatus } from "./LeadPipeline";

export interface LeadKpi {
  total: number;
  byStatus: Record<LeadStatus, number>;
  deliveredOrBetter: number;
  humanReplies: number;
  meetings: number;
  orders: number;
  revenueYen: number;
  profitYen: number;
  replyRate: number;
  orderRate: number;
}

const statuses: LeadStatus[] = [
  "new",
  "qualified",
  "approved",
  "sent",
  "delivered",
  "bounced",
  "auto_reply",
  "human_reply",
  "meeting",
  "order",
  "lost",
];

export function summarizeLeadKpi(leads: LeadRecord[]): LeadKpi {
  const byStatus = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<LeadStatus, number>;
  let revenueYen = 0;
  let profitYen = 0;

  for (const lead of leads) {
    byStatus[lead.status] += 1;
    revenueYen += lead.revenueYen ?? 0;
    profitYen += lead.profitYen ?? 0;
  }

  const deliveredOrBetter =
    byStatus.delivered +
    byStatus.auto_reply +
    byStatus.human_reply +
    byStatus.meeting +
    byStatus.order;

  const humanReplies = byStatus.human_reply + byStatus.meeting + byStatus.order;
  const meetings = byStatus.meeting + byStatus.order;
  const orders = byStatus.order;

  return {
    total: leads.length,
    byStatus,
    deliveredOrBetter,
    humanReplies,
    meetings,
    orders,
    revenueYen,
    profitYen,
    replyRate: deliveredOrBetter === 0 ? 0 : humanReplies / deliveredOrBetter,
    orderRate: deliveredOrBetter === 0 ? 0 : orders / deliveredOrBetter,
  };
}
