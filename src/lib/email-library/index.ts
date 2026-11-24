import { ACCOUNT } from "./account";
import { BILLING } from "./billing";
import { COMPLIANCE } from "./compliance";
import { LEGAL } from "./legal";
import { OUTAGES } from "./outages";
import { PRODUCT } from "./product";
import { SECURITY } from "./security";
import { SECURITY_DDOS } from "./security-ddos";
import { SUCCESS } from "./success";
import { WELCOME } from "./welcome";
import { MORE_ONBOARDING, MORE_SUCCESS, MORE_BILLING, MORE_PRODUCT } from "./more-customers";
import { MORE_ACCOUNT, MORE_COMPLIANCE, MORE_LEGAL, MORE_SECURITY, MORE_OUTAGES } from "./more-ops";
import type { MailTemplate } from "./types";

export type { MailTemplate } from "./types";

/** Every built-in template, grouped in the order the categories appear in the composer. */
export const MAIL_LIBRARY: MailTemplate[] = [...SECURITY, ...SECURITY_DDOS, ...LEGAL, ...OUTAGES, ...PRODUCT, ...WELCOME, ...BILLING, ...SUCCESS, ...ACCOUNT, ...COMPLIANCE, ...MORE_SECURITY, ...MORE_LEGAL, ...MORE_OUTAGES, ...MORE_PRODUCT, ...MORE_ONBOARDING, ...MORE_BILLING, ...MORE_SUCCESS, ...MORE_ACCOUNT, ...MORE_COMPLIANCE];
