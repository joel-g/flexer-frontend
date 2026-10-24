// Synthetic, in-memory adapter for component fixtures only. Never import into production code.
import { readFileSync } from 'node:fs';
import { RunningApiError } from '../../src/running/client.ts';
const fixtures = JSON.parse(readFileSync(new URL('./running-contract.json', import.meta.url)));
export function runningFixtureApi() {
  let plan = structuredClone(fixtures.draftPlan);
  let sequence = 0;
  const calls = [];
  const receipts = new Map();
  const response = () => ({ data: structuredClone(plan), status: 200 });
  const account = { incarnation: fixtures.headers['X-Account-Incarnation'], generation: 0, settingsRevision: 0, historyGeneration: 0, activePlanId: null, preferredUnits: 'mi' };
  const api = {
    async createDraft(body, id) {
      calls.push({ method: 'createDraft', body: structuredClone(body), id });
      if (receipts.has(id)) return structuredClone(receipts.get(id));
      plan = { ...structuredClone(fixtures.draftPlan), revision: 0, intake: structuredClone(body.intake), preview: null, latestImportVersion: null };
      const result = response(); receipts.set(id, result); return result;
    },
    async plan(id) { calls.push({ method: 'plan', id }); return response(); },
    async importPlan(id, text, revision, operationId) {
      calls.push({ method: 'importPlan', id, text, revision, operationId });
      if (receipts.has(operationId)) return structuredClone(receipts.get(operationId));
      if (revision !== plan.revision) throw new RunningApiError(409, { code: 'REVISION_CONFLICT', error: 'Reload the draft.', current: { plan: structuredClone(plan) } });
      let input;
      try { input = JSON.parse(text.replace(/^```json\s*\n|\n```$/g, '')); } catch { throw new RunningApiError(422, { code: 'VALIDATION_FAILED', error: 'Correct the JSON.', fieldErrors: [{ path: '', code: 'INVALID_JSON', message: 'Use one JSON object.' }] }); }
      if (input.schemaVersion !== 1 || !Array.isArray(input.weeks)) throw new RunningApiError(422, { code: 'VALIDATION_FAILED', error: 'Correct the plan.', fieldErrors: [{ path: '/schemaVersion', code: 'INVALID_FIELD', message: 'Use schema version 1.' }] });
      const differences = [['goal', plan.intake.goalText, input.planGoal], ['start', plan.intake.start, input.start], ['end', plan.intake.end, input.end], ['raceDate', plan.intake.raceDate, input.raceDate]].filter(([, requested, proposed]) => requested !== proposed).map(([field, requested, proposed]) => ({ field, requested, proposed }));
      const version = (plan.latestImportVersion ?? 0) + 1;
      plan = { ...plan, revision: plan.revision + 1, latestImportVersion: version, preview: { importVersion: version, plan: input, previewAcceptanceToken: `60000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`, differences } };
      const result = response(); receipts.set(operationId, result); return result;
    },
    async activate(id, body, operationId) {
      calls.push({ method: 'activate', id, body, operationId });
      if (receipts.has(operationId)) return structuredClone(receipts.get(operationId));
      if (body.expectedRevision !== plan.revision || body.previewAcceptanceToken !== plan.preview?.previewAcceptanceToken || body.expectedGeneration !== account.generation) throw new RunningApiError(409, { code: 'REVISION_CONFLICT', error: 'Review the latest draft.' });
      plan = { ...plan, revision: plan.revision + 1, lifecycle: 'active', activatedVersion: plan.preview.importVersion, everActivated: true, preview: null, program: structuredClone(fixtures.activePlan.program) };
      account.generation++; account.activePlanId = plan.id;
      const result = response(); receipts.set(operationId, result); return result;
    },
  };
  return { api, account, calls };
}
