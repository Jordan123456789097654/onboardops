import type { MailCategory, MailIcon } from "../email-markup";

export type MailTemplate = {
  id: string;
  cat: MailCategory;
  title: string;
  desc: string;
  subject: string;
  preheader: string;
  icon: MailIcon;
  /** Button label and address. The address is usually {{action_url}}, which the sender fills in. */
  button?: [string, string];
  /** Body in the composer's markup. Blank lines separate paragraphs. */
  body: string;
  builtin: true;
};

/** Short constructor so the library files stay readable. */
export const tpl = (cat: MailCategory, id: string, title: string, desc: string, icon: MailIcon, subject: string, preheader: string, button: [string, string] | undefined, body: string): MailTemplate => ({
  id: `${cat.slice(0, 3).toLowerCase()}-${id}`, cat, title, desc, icon, subject, preheader, button, body: body.trim(), builtin: true,
});
