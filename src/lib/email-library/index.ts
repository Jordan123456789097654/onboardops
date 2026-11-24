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
import type { MailTemplate } from "./types";

export type { MailTemplate } from "./types";

/** Every built-in template, grouped in the order the categories appear in the composer. */
export const MAIL_LIBRARY: MailTemplate[] = [...SECURITY, ...SECURITY_DDOS, ...LEGAL, ...OUTAGES, ...PRODUCT, ...WELCOME, ...BILLING, ...SUCCESS, ...ACCOUNT, ...COMPLIANCE];
