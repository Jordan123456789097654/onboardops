export const CORE_STATUSES = ["OPEN", "WAITING", "SOLVED"] as const;
export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
export const CATEGORIES = ["Bug", "Billing", "Setup", "Access", "Feature", "Question"] as const;
export const DEFAULT_TAGS = ["bug", "billing", "onboarding", "general", "feature-request", "account"];
