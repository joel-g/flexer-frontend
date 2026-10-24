import type { AccountState, Activation, CanonicalPlan } from './contract.ts';

export function previewIdentity(plan: CanonicalPlan): string {
  return `${plan.id}:${plan.revision}:${plan.preview?.importVersion ?? ''}:${plan.preview?.previewAcceptanceToken ?? ''}`;
}
/** Consent covers both the imported prescription and the running plan it replaces. */
export function activationReviewIdentity(plan: CanonicalPlan, account: AccountState): string {
  return JSON.stringify([previewIdentity(plan), account.incarnation, account.generation, account.activePlanId]);
}
export function activationFromReview(plan: CanonicalPlan, account: AccountState, reviewedPreview: string | null, acceptedDifferences: ReadonlySet<number>, online: boolean): Activation {
  if (!online) throw new Error('Connect to the internet before activating a plan.');
  const preview = plan.preview;
  if (plan.lifecycle !== 'draft' || !preview || preview.importVersion !== plan.latestImportVersion) throw new Error('Load the current draft preview before activating.');
  if (reviewedPreview !== activationReviewIdentity(plan, account)) throw new Error('Review this exact preview and current running plan replacement before activating.');
  if (preview.differences.some((_difference, index) => !acceptedDifferences.has(index))) throw new Error('Explicitly accept each proposed goal or date change.');
  return { expectedRevision: plan.revision, importVersion: preview.importVersion, expectedGeneration: account.generation, expectedActivePlanId: account.activePlanId, previewAcceptanceToken: preview.previewAcceptanceToken };
}
/** One ID per unchanged operation payload, reused after uncertain failures; never reused after edits. */
export class OperationIdentity {
  private value: { payload: string; id: string } | null = null;
  forPayload(payload: unknown, generate: () => string = () => crypto.randomUUID()): string {
    const serialized = JSON.stringify(payload);
    if (!this.value || this.value.payload !== serialized) this.value = { payload: serialized, id: generate() };
    return this.value.id;
  }
  clear() { this.value = null; }
}
