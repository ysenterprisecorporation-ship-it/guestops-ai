export type LeadProject = '1' | '2' | '3';

export type LeadStatus =
  | 'new'
  | 'qualified'
  | 'approved'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'auto_reply'
  | 'human_reply'
  | 'meeting'
  | 'order'
  | 'lost';

export interface LeadRecord {
  project: LeadProject;
  companyName: string;
  sourceUrl: string;
  officialContact?: string;
  contactType?: 'email' | 'form' | 'social' | 'other';
  fitScore: number;
  fitEvidence: string[];
  deliveryRisk: 'low' | 'medium' | 'high' | 'unknown';
  status: LeadStatus;
  revenueYen?: number;
  profitYen?: number;
  lastEventAt?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function leadKey(lead: Pick<LeadRecord, 'companyName' | 'officialContact' | 'sourceUrl'>): string {
  const contact = lead.officialContact ? normalize(lead.officialContact) : '';
  if (contact) return `contact:${contact}`;
  return `company:${normalize(lead.companyName)}|url:${normalize(lead.sourceUrl)}`;
}

export function dedupeLeads(leads: LeadRecord[]): LeadRecord[] {
  const seen = new Set<string>();
  const result: LeadRecord[] = [];
  for (const lead of leads) {
    const key = leadKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(lead);
  }
  return result;
}

const allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
  new: ['qualified', 'lost'],
  qualified: ['approved', 'lost'],
  approved: ['sent', 'lost'],
  sent: ['delivered', 'bounced', 'auto_reply', 'human_reply', 'lost'],
  delivered: ['auto_reply', 'human_reply', 'meeting', 'order', 'lost'],
  bounced: ['approved', 'lost'],
  auto_reply: ['human_reply', 'meeting', 'order', 'lost'],
  human_reply: ['meeting', 'order', 'lost'],
  meeting: ['order', 'lost'],
  order: [],
  lost: ['qualified'],
};

export function canTransitionLeadStatus(from: LeadStatus, to: LeadStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionLead(lead: LeadRecord, to: LeadStatus, at = new Date().toISOString()): LeadRecord {
  if (lead.status === to) return { ...lead, lastEventAt: at };
  if (!canTransitionLeadStatus(lead.status, to)) {
    throw new Error(`Invalid lead status transition: ${lead.status} -> ${to}`);
  }
  return { ...lead, status: to, lastEventAt: at };
}

export function rankLeads(leads: LeadRecord[]): LeadRecord[] {
  const riskPenalty = { low: 0, medium: 10, high: 25, unknown: 5 } as const;
  return [...leads].sort((a, b) => {
    const aScore = a.fitScore - riskPenalty[a.deliveryRisk];
    const bScore = b.fitScore - riskPenalty[b.deliveryRisk];
    return bScore - aScore;
  });
}
