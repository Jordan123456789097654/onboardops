import type { Section } from "../content";
import { termsMore } from "./terms-of-service";
import { touMore } from "./terms-of-use";
import { privacyMore } from "./privacy";
import { aupMore } from "./acceptable-use";
import { cookiesMore } from "./cookies";
import { dpaMore } from "./data-processing";
import { betaMore } from "./beta-terms";
import { employeeMore } from "./employee-notice";
import { retentionMore } from "./retention";

/** Additional detailed sections appended to each document, keyed by URL slug. */
export const moreSections: Record<string, Section[]> = {
  "terms-of-service": termsMore,
  "terms-of-use": touMore,
  privacy: privacyMore,
  "acceptable-use": aupMore,
  cookies: cookiesMore,
  "data-processing": dpaMore,
  "beta-terms": betaMore,
  "employee-notice": employeeMore,
  retention: retentionMore,
};
