export type GmoSignPlan =
  | "TRIAL"
  | "LIGHT"
  | "CONTRACT_SEAL"
  | "STANDARD"
  | "BUSINESS"
  | "ENTERPRISE";

export interface GmoSignConfig {
  organizationId: string;
  apiSecret: string;
  plan: GmoSignPlan;
}

export interface GmoSignCompletionEvent {
  contractId: string;
  completedAtIso: string;
}

export function assertGmoSignApiReady(config: GmoSignConfig) {
  if (!config.organizationId.trim()) throw new Error("GMO_SIGN_ORGANIZATION_ID_REQUIRED");
  if (!config.apiSecret.trim()) throw new Error("GMO_SIGN_API_SECRET_REQUIRED");

  if (config.plan === "TRIAL" || config.plan === "LIGHT") {
    throw new Error("GMO_SIGN_API_PLAN_UNSUPPORTED");
  }

  if (config.plan === "CONTRACT_SEAL") {
    throw new Error("GMO_SIGN_API_OPTION_NEW_SIGNUP_UNAVAILABLE");
  }
}

export function parseGmoSignCompletionWebhook(
  payload: unknown,
): GmoSignCompletionEvent {
  if (!payload || typeof payload !== "object") {
    throw new Error("GMO_SIGN_WEBHOOK_INVALID");
  }

  const data = payload as Record<string, unknown>;
  const contractId =
    typeof data.contractId === "string" ? data.contractId :
    typeof data.contract_id === "string" ? data.contract_id :
    "";

  const completedAtIso =
    typeof data.completedAt === "string" ? data.completedAt :
    typeof data.completed_at === "string" ? data.completed_at :
    "";

  if (!contractId.trim()) throw new Error("GMO_SIGN_CONTRACT_ID_REQUIRED");
  if (!completedAtIso || !Number.isFinite(Date.parse(completedAtIso))) {
    throw new Error("GMO_SIGN_COMPLETED_AT_INVALID");
  }

  return { contractId, completedAtIso };
}

/**
 * The public help center confirms API integration, Organization ID,
 * API secret, and JSON webhook delivery on signature completion.
 * The public material does not expose a stable document-send endpoint schema.
 * Keep actual send transport injected until the account-specific API
 * specification is available; do not invent an endpoint.
 */
export interface GmoSignSendTransport {
  sendContract(input: {
    bookingId: string;
    signerEmail: string;
    documentRef: string;
    idempotencyKey: string;
  }): Promise<{ contractId: string }>;
}

export class GmoSignAdapter {
  constructor(
    private readonly config: GmoSignConfig,
    private readonly transport: GmoSignSendTransport,
  ) {}

  async sendContract(input: {
    bookingId: string;
    signerEmail: string;
    documentRef: string;
    idempotencyKey: string;
  }) {
    assertGmoSignApiReady(this.config);
    if (!input.signerEmail.trim()) throw new Error("SIGNER_EMAIL_REQUIRED");
    if (!input.documentRef.trim()) throw new Error("DOCUMENT_REF_REQUIRED");
    return this.transport.sendContract(input);
  }
}
