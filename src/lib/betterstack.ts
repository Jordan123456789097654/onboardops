/**
 * Status page API adapter — now backed by Kener v4 (src/lib/kener.ts).
 * Re-exported under legacy names so existing imports keep working cleanly.
 */
export {
  STATUS_PAGE_URL,
  kenerConfigured as betterstackConfigured,
  kenerOverview as bsOverview,
  kenerCreateIncident as bsCreateIncident,
  kenerUpdateIncident as bsUpdateIncident,
  kenerScheduleMaintenance as bsScheduleMaintenance,
  kenerEndMaintenance as bsEndMaintenance,
  kenerDeleteReport as bsDeleteReport,
  reconcileMaintenance,
  syncDegraded,
  maybeReconcile,
  type BsMonitor,
  type BsReport,
  type BsResource,
} from "./kener";
