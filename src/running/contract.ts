// Normative transport types, contract v1. All IDs are opaque server-generated UUIDs except client operation/mutation UUIDs.
// Authorization/ownership must precede use of any revision/incarnation token.
export type LocalDate = string; // strict Gregorian YYYY-MM-DD
export type Id = string;
export type Distance = { value: number; unit: 'm'|'km'|'mi' };
export type Target = { kind:'distance'; value:number; unit:'m'|'km'|'mi' } | {kind:'duration';value:number;unit:'seconds'|'minutes'};
export type CanonicalTarget = {kind:'distance';meters:number;seconds:null}|{kind:'duration';meters:null;seconds:number};
export type Day = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';
export type Race = '5k'|'10k'|'half_marathon'|'marathon';
export interface Intake {
  goalText:string;objective:'finish_race'|'improve_time'|'build_base';raceChoice:Race|null;
  start:LocalDate;end:LocalDate;raceDate:LocalDate|null;timeZone:string;distanceUnit:'mi'|'km';
  recentVolume:{distance:Distance;periodStart:LocalDate;periodEnd:LocalDate}|null;
  lastFourWeeklyTotals:Array<{start:LocalDate;distance:Distance|null}>|null;
  runsPerWeek:number|null;longestRun:{distance:Distance;date:LocalDate|null}|null;
  raceHistory:Array<{raceChoice:Race;count:number;periodMonths:number|null;date:LocalDate|null;durationSeconds:number|null;notes:string}>|null;
  interruptions:string|null;limitations:string|null;availableDays:Day[]|null;longRunDay:Day|null;availableMinutesPerRun:number|null;
  liftingDays:Day[]|null;liftingPriority:'running'|'strength'|'balanced'|null;liftingContextConfirmed:true;
}
export interface ImportV1 {
  schemaVersion:1;name:string;requestedGoal:string;planGoal:string;rationale:string;assumptions:string[];cautions:string[];
  start:LocalDate;end:LocalDate;raceDate:LocalDate|null;
  weeks:Array<{start:LocalDate;focus:string;notes:string;runs:Array<{date:LocalDate;type:'easy'|'long'|'recovery'|'tempo'|'interval'|'run_walk'|'race'|'other';title:string;target:Target;effort:string;paceRange?:{minSecondsPerKm:number;maxSecondsPerKm:number}|null;notes?:string}>}>;
}
export interface DraftCreate {intake:Intake} // X-Operation-Id and X-Account-Incarnation
export type Bootstrap = Record<string,never>; // {} only, setup-only exception; never queued
export interface PreferencesPut {expectedRevision:number;preferredUnits:'mi'|'km'} // X-Account-Incarnation; revision=settingsRevision
export interface Activation {expectedRevision:number;importVersion:number;expectedGeneration:number;expectedActivePlanId:Id|null;previewAcceptanceToken:Id} // opaque random token, NOT content digest
export interface Archive {expectedRevision:number;expectedGeneration:number} // X-Operation-Id and incarnation
export interface ResultPut {
  mutationId:Id;expectedRevision:number;status:'pending'|'completed'|'skipped';
  actualDate:LocalDate|null;actualDistance:Distance|null;durationSeconds:number|null;paceSecondsPerKm:number|null;
  effortRpe?:number|null;notes?:string|null;
}
export interface SchedulePut {mutationId:Id;expectedRevision:number;date:LocalDate}
export interface CanonicalRun {
  id:Id;planId:Id;originalDate:LocalDate;scheduledDate:LocalDate;revision:number;status:'pending'|'completed'|'skipped';
  actualDate:LocalDate|null;actualMeters:number|null;durationSeconds:number|null;durationSource:'entered'|'derived_from_pace'|null;effortRpe:number|null;notes:string|null;
}
export interface CanonicalProgram {
  importVersion:number;name:string;requestedGoal:string;planGoal:string;rationale:string;assumptions:string[];cautions:string[];
  start:LocalDate;end:LocalDate;raceDate:LocalDate|null;
  weeks:Array<{id:Id;start:LocalDate;focus:string;notes:string;runs:Array<{
    id:Id;weekId:Id;originalDate:LocalDate;type:ImportV1['weeks'][number]['runs'][number]['type'];title:string;
    target:CanonicalTarget;effort:string;paceRange:{minSecondsPerKm:number;maxSecondsPerKm:number}|null;notes:string;result:CanonicalRun;
  }>}>
}
export interface CanonicalPlan {
  id:Id;revision:number;lifecycle:'draft'|'active'|'archived';timeZone:string;intake:Intake;
  latestImportVersion:number|null;activatedVersion:number|null;everActivated:boolean;
  preview: {importVersion:number;plan:ImportV1;previewAcceptanceToken:Id;differences:Array<{field:'goal'|'start'|'end'|'raceDate';requested:string|null;proposed:string|null}>}|null;
  program:CanonicalProgram|null; // null iff never activated; immutable activated version plus current mutable results
}
export interface AccountState {incarnation:Id;generation:number;settingsRevision:number;historyGeneration:number;activePlanId:Id|null;preferredUnits:'mi'|'km'}
export type StateData = {enabled:false;code:'FEATURE_DISABLED'}|{enabled:true;account:AccountState|null;activePlan:CanonicalPlan|null;draftCount:number};
export type PlanListFilter = 'draft'|'archived'|'all';
export interface PlanListQuery {lifecycle:PlanListFilter;limit:number;cursor:string|null} // wire query limit decimal string; defaults all/20
export interface PlanListItem {id:Id;lifecycle:'draft'|'active'|'archived';revision:number;name:string;createdAt:string;updatedAt:string} // timestamps exactly YYYY-MM-DDTHH:mm:ss.sssZ
export interface PlanListData {items:PlanListItem[];nextCursor:string|null;historyGeneration:number}
export interface PlanListCursorV1 {v:1;incarnation:Id;lifecycle:PlanListFilter;limit:number;historyGeneration:number;boundary:{createdAt:string;id:Id}} // untrusted base64url navigation, NEVER authorization
export interface RunningHistoryQuery {view:'actual'|'scheduled';from:LocalDate;to:LocalDate;planId:Id|null;limit:number;cursor:string|null}
export interface RunningHistoryItem {planId:Id;planName:string;timeZone:string;runId:Id;type:ImportV1['weeks'][number]['runs'][number]['type'];title:string;target:CanonicalTarget;result:CanonicalRun}
export interface RunningHistoryData {items:RunningHistoryItem[];nextCursor:string|null;historyGeneration:number;view:'actual'|'scheduled';from:LocalDate;to:LocalDate;planId:Id|null}
export interface RunningHistoryCursorV1 {v:1;kind:'running-history';incarnation:Id;view:'actual'|'scheduled';from:LocalDate;to:LocalDate;planId:Id|null;limit:number;historyGeneration:number;boundary:{date:LocalDate;runId:Id}}
export interface RunningAnalyticsQuery {from:LocalDate;to:LocalDate;planId:Id|null}
export interface ActualTotals {completedRuns:number;distanceMeters:number;timedRuns:number;timedDistanceMeters:number;durationSeconds:number;weightedPaceSecondsPerKm:number|null}
export interface PlannedTotals {runs:number;distanceRuns:number;durationRuns:number;distanceMeters:number;durationSeconds:number}
export interface AdherenceTotals {scheduledRuns:number;completedRuns:number;skippedRuns:number;pendingRuns:number}
export interface RunningAnalyticsData {from:LocalDate;to:LocalDate;planId:Id|null;historyGeneration:number;dateBasis:'plan-local';actual:ActualTotals;planned:PlannedTotals;adherence:AdherenceTotals;weeks:Array<{start:LocalDate;actual:ActualTotals;planned:PlannedTotals;adherence:AdherenceTotals}>}
export interface FieldError {path:string;code:string;message:string}
export type ErrorCode='AUTH_REQUIRED'|'FEATURE_DISABLED'|'NOT_FOUND'|'REVISION_CONFLICT'|'STALE_OPERATION'|'OPERATION_ID_REUSED'|'ACCOUNT_REPLACED'|'SCHEDULE_COLLISION'|'HISTORY_CHANGED'|'PAYLOAD_TOO_LARGE'|'VALIDATION_FAILED'|'RATE_LIMITED'|'TEMPORARY_FAILURE';
export type ApiResponse<T> = {success:true;data:T}|{success:false;error:string;code:ErrorCode;requestId:string;fieldErrors?:FieldError[];current?:{run?:CanonicalRun;plan?:CanonicalPlan;account?:AccountState}};
// CanonicalPlan.preview appears only for owned draft reads. Never return private receipt fingerprint/attemptNonce.
