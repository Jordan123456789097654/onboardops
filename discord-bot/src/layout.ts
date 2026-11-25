import { PermissionFlagsBits as P } from "discord.js";

/** Everything /setup creates. Change this file, then run /setup again: missing pieces are added and permissions are re-applied. */

export const STAFF_ROLES = ["Owner", "Admin", "Support", "Moderator", "Developer", "Viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Roles anyone on staff can give themselves from the picker, to choose which alerts ping them. */
export const PING_ROLES = ["Ping: Support", "Ping: Incidents", "Ping: Status", "Ping: Announcements", "On call"] as const;

export const ONCALL_ROLE = "On call";
export const LEAVE_ROLE = "On leave";

/** Which channel each website notice goes to. /webhooks creates one webhook per channel. */
export const WEBHOOK_CHANNELS: Record<string, string> = {
  SUPPORT: "support-tickets",
  URGENT: "support-urgent",
  STATUS: "status-incidents",
  MODLOG: "mod-log",
  APPEALS: "appeals",
  ALERTS: "alerts",
  DEPLOYS: "deploys",
};

export type RoleSpec = { name: string; color: number; hoist: boolean; mentionable: boolean; permissions: bigint };

const BASE = P.ViewChannel | P.SendMessages | P.ReadMessageHistory | P.EmbedLinks | P.AttachFiles | P.AddReactions | P.UseApplicationCommands | P.SendMessagesInThreads | P.CreatePublicThreads;
const MODERATION = P.ManageMessages | P.ModerateMembers | P.ManageThreads;

/** No role gets Administrator or any server-wide management power. The server owner can adjust that by hand if needed. */
export const ROLE_SPECS: RoleSpec[] = [
  { name: "Owner", color: 0xdc2626, hoist: true, mentionable: false, permissions: BASE | MODERATION },
  { name: "Admin", color: 0xea580c, hoist: true, mentionable: false, permissions: BASE | MODERATION },
  { name: "Moderator", color: 0x2563eb, hoist: true, mentionable: false, permissions: BASE | P.ManageMessages | P.ModerateMembers },
  { name: "Support", color: 0x16a34a, hoist: true, mentionable: false, permissions: BASE },
  { name: "Developer", color: 0x7c3aed, hoist: true, mentionable: false, permissions: BASE },
  { name: "Viewer", color: 0x6b7280, hoist: false, mentionable: false, permissions: P.ViewChannel | P.ReadMessageHistory | P.AddReactions | P.UseApplicationCommands },
  { name: "On leave", color: 0x9ca3af, hoist: false, mentionable: false, permissions: 0n },
  ...PING_ROLES.map((name) => ({ name, color: 0x94a3b8, hoist: false, mentionable: true, permissions: 0n })),
];

export type ChannelSpec = {
  name: string;
  topic: string;
  /** Roles that can see the channel. Owner and Admin always can. */
  read: readonly StaffRole[];
  /** Roles that can write. Leave out to match `read`. An empty list means read-only: only the bot posts. */
  post?: readonly StaffRole[];
};
export type CategorySpec = { name: string; channels: ChannelSpec[] };

const ALL = STAFF_ROLES;
const SENIOR = ["Owner", "Admin"] as const;
const SUPPORT = ["Owner", "Admin", "Support"] as const;
const MOD = ["Owner", "Admin", "Moderator"] as const;
const DEV = ["Owner", "Admin", "Developer"] as const;

export const CATEGORIES: CategorySpec[] = [
  {
    name: "INFORMATION",
    channels: [
      { name: "welcome-rules", topic: "Read this first. The rules for staff.", read: ALL, post: [] },
      { name: "announcements", topic: "Team announcements.", read: ALL, post: SENIOR },
      { name: "roles", topic: "Pick which alerts ping you.", read: ALL, post: [] },
    ],
  },
  {
    name: "SUPPORT",
    channels: [
      { name: "support-tickets", topic: "New support tickets appear here.", read: SUPPORT },
      { name: "support-urgent", topic: "Urgent and security tickets.", read: SUPPORT },
      { name: "saved-replies", topic: "Canned replies the team uses.", read: SUPPORT },
    ],
  },
  {
    name: "STATUS & OPERATIONS",
    channels: [
      { name: "status-incidents", topic: "Incidents and maintenance from the status page.", read: ALL, post: DEV },
      { name: "uptime-reports", topic: "Weekly uptime and health reports.", read: ALL, post: [] },
      { name: "deploys", topic: "Deploy notifications.", read: DEV },
      { name: "alerts", topic: "Health, email and sign-in alerts.", read: DEV, post: [] },
    ],
  },
  {
    name: "MODERATION",
    channels: [
      { name: "moderation-queue", topic: "Reports and cases waiting for a moderator.", read: MOD },
      { name: "appeals", topic: "Appeals waiting for a decision.", read: MOD },
      { name: "mod-log", topic: "Every moderation action. Read-only.", read: MOD, post: [] },
    ],
  },
  {
    name: "DEVELOPMENT",
    channels: [
      { name: "dev-chat", topic: "Engineering discussion.", read: DEV },
      { name: "dev-notes", topic: "Longer notes and decisions.", read: DEV },
    ],
  },
  {
    name: "TEAM",
    channels: [
      { name: "staff-chat", topic: "General staff chat.", read: ALL, post: ["Owner", "Admin", "Support", "Moderator", "Developer"] },
      { name: "standup", topic: "Daily standup thread.", read: ALL, post: ["Owner", "Admin", "Support", "Moderator", "Developer"] },
      { name: "oncall-and-loa", topic: "Who is on call, and who is on leave.", read: ALL, post: [] },
      { name: "tasks", topic: "Task lists.", read: ["Owner", "Admin", "Support", "Moderator", "Developer"] },
    ],
  },
  {
    name: "LOGS",
    channels: [
      { name: "bot-log", topic: "Every bot command, with who ran it. Read-only.", read: SENIOR, post: [] },
      { name: "audit-log", topic: "Staff audit events. Read-only.", read: SENIOR, post: [] },
    ],
  },
];

export const RULES_TITLE = "Staff rules";
export const RULES_FOOTER = "OnboardOps staff rules v1";
export const RULES = [
  "**1. Treat customer data as private.** Never paste employee names, records, or anything from a customer workspace into Discord. Use ticket references and the admin panel.",
  "**2. No secrets in chat.** Never post passwords, API keys, tokens, or database links. If one is posted by mistake, tell an Owner right away so it can be changed.",
  "**3. Use the admin panel for decisions.** Bans, suspensions and refunds are done there or with the confirmed bot commands, never by asking someone in chat.",
  "**4. Report security problems immediately** in #support-urgent and tag an Owner.",
  "**5. Be respectful.** Disagree about the work, not the person.",
  "**6. Say when you are away.** Use the leave command so the team knows who can answer.",
];
export const PICKER_TITLE = "Choose your alerts";
export const PICKER_FOOTER = "OnboardOps role picker v1";
