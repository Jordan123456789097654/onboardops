import Link from "next/link";
import { SITE } from "@/lib/site";
import type { Doc, Section } from "./content";

const C = () => <Link href="/contact">contact form</Link>;
const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className="mt-3 overflow-x-auto rounded-lg border border-line">
    <table className="w-full min-w-[520px] border-collapse text-left">
      <thead><tr>{head.map((h) => <th key={h} className="th !static !normal-case !tracking-normal">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`td align-top text-[13px] ${j === 0 ? "font-medium text-ink" : "text-soft"}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

/** Sections added after the section whose title is the key. */
type Extra = Record<string, Section[]>;

const tos: Extra = {
  Definitions: [
    { title: "The Service in detail", body: <>
      <p>The Service is a web application for recording and managing workforce information. Depending on your role and the features available during the beta, it includes:</p>
      <ul>
        <li><strong>Staff records:</strong> employee profiles, departments, job roles, statuses, documents, shift availability and checklists.</li>
        <li><strong>Training:</strong> a course builder, quizzes graded on the server, certificates, reminders, due dates and expiring certifications.</li>
        <li><strong>Conduct records:</strong> infraction cases with timelines, acknowledgments, incident reports, performance reviews and 1:1 notes.</li>
        <li><strong>Policies:</strong> publishing, versioning and tracking employee acknowledgments.</li>
        <li><strong>Requests:</strong> leave of absence, retirement and resignation requests, with manager decisions.</li>
        <li><strong>Accounts and access:</strong> invites, magic-link sign-in, workplace staff sign-in pages, optional custom domains and account settings.</li>
        <li><strong>Notifications:</strong> in-app alerts, email and webhooks to Discord, Slack or Microsoft Teams that a Customer configures.</li>
        <li><strong>Records and audit:</strong> an append-only audit log, exports and printable documents.</li>
      </ul>
      <p>Features are described in the product, in the help center and on our website. Descriptions are summaries, and the Service may behave differently in specific situations. We do not promise that any feature will remain available in its current form.</p>
    </> },
    { title: "Beta status", body: <>
      <p>The Service is in beta. During the beta, the Service is free, may change quickly, may contain errors, and may be unavailable at times. The <Link href="/legal/beta-terms">Beta Program Terms</Link> add specific terms about data, feedback and the end of the beta, and control if they conflict with this section.</p>
      <p>You agree that you will not rely on the beta as the only copy of any record you are legally required to keep, and that you will keep your own backups of critical information using the export tools available to you.</p>
    </> },
  ],
  "Accounts, Workspaces and roles": [
    { title: "Account security", body: <>
      <p>You are responsible for the security of your sign-in methods. In particular:</p>
      <ul>
        <li>Use a strong, unique password, and do not share it. If you sign in with email links, you are responsible for keeping access to that email account secure.</li>
        <li>Every sign-in link we send works once and expires quickly. Do not forward a sign-in, invite or password-reset email to anyone.</li>
        <li>You may add more email addresses to your account in account settings. Only verified addresses can be used to sign in or to match you to employer records, and you should remove addresses you no longer control.</li>
        <li>After repeated wrong passwords, we temporarily lock sign-in for that account to protect it. You can still use a sign-in link or reset your password.</li>
        <li>Changing your password signs out your other devices. You can also sign out other devices from account settings at any time.</li>
      </ul>
      <p>Tell us immediately through the <C /> if you believe your account has been compromised. We may require you to reset credentials or verify your identity before restoring access.</p>
    </> },
    { title: "Workspace owners and administrators", body: <>
      <p>The Owner of a Workspace has the highest level of control and is responsible for how the Workspace is used. Owners and Admins can invite people, assign roles, change settings, manage notifications and webhooks, connect a custom domain, export data and, for Owners only, close the Workspace.</p>
      <p>If the Owner leaves or becomes unavailable, we may, after reasonable verification and at our discretion, help transfer ownership to another authorized person at the Customer. We will not transfer ownership based only on an unverified request, and we record every transfer in the Workspace audit log.</p>
    </> },
    { title: "Employee accounts and joining a workplace", body: <>
      <p>A person may create an OnboardOps account on their own without a Workspace. They can only join a Workspace when (a) a Customer has created an employee record that matches an email address the person has verified, and the person chooses to join it, or (b) the Customer sends an invitation. Creating an account does not give the Customer any right to the account, and does not give the person any right to a Workspace.</p>
      <p>When a person joins a Workspace, the Customer controls the employment-related records and access in that Workspace. When the Customer closes the person&apos;s employee record, the person loses access to that Workspace but keeps their account and any other Workspaces they belong to. A person may be employed by several Customers at once.</p>
    </> },
    { title: "Custom domains and staff sign-in pages", body: <>
      <p>Each Workspace has a staff sign-in page. An Owner or Admin may connect a custom domain to it. If you connect a domain, you represent that you own or control it, you will keep its DNS records accurate, and you will not use it to mislead people about who operates the Service. Visitors to your domain see your Workspace&apos;s sign-in page and only your Workspace.</p>
      <p>We rely on third-party infrastructure to serve custom domains and issue certificates. We do not guarantee that a particular domain will work, and may disconnect a domain that is misused, that points to unsafe content, or that you stop controlling. Connecting a domain does not give you any rights in OnboardOps names or marks.</p>
    </> },
  ],
  "Customer Data": [
    { title: "Exporting, retention and deletion", body: <>
      <p>Owners and Admins can export Workspace data at any time using the export tools, and every export is recorded in the audit log. Exports can include confidential information, so the Customer is responsible for storing them securely.</p>
      <p>Customers are responsible for deciding how long to keep each kind of record. The Service keeps infraction cases, timeline notes and audit entries in append-only form while the Workspace is active. When a Workspace is closed, we delete or de-identify its data as described in the <Link href="/legal/retention">Data Retention and Deletion Policy</Link>.</p>
    </> },
    { title: "Reviews, 1:1 notes and incident reports", body: <>
      <p>The Service lets managers write performance reviews and 1:1 notes, and lets anyone in a Workspace file an incident report. Private manager notes are never shown to the employee in the Service, and shared entries are locked. These are the Customer&apos;s records, created for the Customer&apos;s purposes. The Customer is responsible for their accuracy and fairness, for any legal right an employee has to see or correct them, and for not using incident reports to retaliate against someone who reported in good faith.</p>
    </> },
    { title: "Legal requests and holds", body: <>
      <p>If we receive a subpoena, court order or similar legal request for Customer Data, we will direct the requester to the Customer where we can, and will notify the Customer before disclosing Customer Data unless the law prohibits it or there is an emergency involving a risk of harm. We will disclose only what we are legally required to disclose.</p>
      <p>If a Customer tells us that records are subject to a legal hold, we will not delete the Workspace until the Customer releases the hold, subject to our right to suspend or terminate for the reasons stated in these Terms.</p>
    </> },
  ],
  "Acceptable use and suspension": [
    { title: "OnboardOps staff access and support", body: <>
      <p>OnboardOps personnel do not have default access to the contents of your Workspace. To help resolve a problem, a staff member may start support access, which requires a written reason, is read-only at Supervisor level (no confidential manager notes, documents or reviews), lasts a limited time, notifies the Workspace Owner by email and in the app, and is recorded in your Workspace audit log and in our own staff activity log.</p>
      <p>We may also see account-level information and counts to operate the Service. By using the Service you authorize this access. We may use emergency access outside this process only where necessary to prevent serious harm or to comply with law, and we will record and, where permitted, tell you about it.</p>
    </> },
    { title: "Locked Workspaces", body: <p>If we lock a Workspace under this section, we will give the Owner the reason, tell them how to resolve it, and let the Owner sign in to read the reason and download an export. We will unlock the Workspace once the issue is resolved to our reasonable satisfaction.</p> },
  ],
  "Support": [
    { title: "Communications", body: <>
      <p>We send you service emails that are necessary to operate your account, such as verification links, sign-in links, password resets, invitations, security alerts, notices about your Workspace and changes to our terms. You cannot opt out of these while you have an account. We send workplace notifications on behalf of Customers, for example training reminders and notices that need your signature, and those follow the Customer&apos;s settings.</p>
      <p>We do not send marketing email without your agreement. You consent to receive notices from us electronically, and you agree that electronic records and typed-name acknowledgments, where the Service offers them, are valid to the extent the law allows, including under the federal E-SIGN Act and applicable state electronic-transactions laws.</p>
    </> },
    { title: "Availability and maintenance", body: <p>We aim to keep the Service available, but we do not promise any particular uptime. We may perform maintenance, sometimes without notice, and the Service may be affected by events outside our control, including failures of third-party infrastructure, email delivery problems, DNS issues and internet outages. Notifications by email and webhook are sent on a best-effort basis and can be delayed or fail. Do not rely on them as your only way to deliver a legally required notice.</p> },
  ],
  "Intellectual property and feedback": [
    { title: "Trademarks and branding", body: <p>OnboardOps and its logo are our marks. The Service lets you show your company name on your staff sign-in page. You grant us a limited license to display your company name and any logo or text you provide solely to operate the Service for you. You may not use our marks without our written permission, except to truthfully refer to the Service.</p> },
    { title: "Copyright complaints", body: <p>If you believe content in the Service infringes your copyright, send a written notice through the <C /> with the topic &ldquo;Legal notice,&rdquo; identifying the work, the location of the material, your contact information, a statement that you have a good-faith belief the use is not authorized, and a statement under penalty of perjury that your notice is accurate and you are authorized to act. We may remove material and notify the Customer, who may respond with a counter-notice. We may terminate accounts of repeat infringers.</p> },
  ],
  "Term and termination": [
    { title: "What happens to your account and Workspaces", body: <>
      <ul>
        <li><strong>Closing a Workspace.</strong> The Owner can close a Workspace in settings. Closing permanently deletes the Workspace and its data and cannot be undone.</li>
        <li><strong>Closing your account.</strong> You can ask us to delete your account through a privacy request. If you are the sole Owner of a Workspace, you must first transfer ownership or close the Workspace.</li>
        <li><strong>Employees leaving.</strong> When an employer closes an employee record, that person loses access to the employer&apos;s Workspace. Their personal account remains.</li>
        <li><strong>Our right to end the Service.</strong> We may discontinue the Service or the beta. We will try to give notice and a chance to export before we do.</li>
      </ul>
    </> },
  ],
  "Limitation of liability": [
    { title: "Allocation of risk", body: <p>You acknowledge that the Service is provided free of charge during the beta and that the limits in these Terms reflect a reasonable allocation of risk. You are responsible for decisions you make using records in the Service, including hiring, discipline, leave and separation decisions. We are not a party to your employment relationships and are not liable for claims by your employees, applicants or former employees arising from your use of the Service.</p> },
  ],
};

const privacy: Extra = {
  "Information we collect": [
    { title: "Information about employees that employers provide", body: <>
      <p>A Customer can record information about its staff, including name, contact details, emergency contact, staff ID, department, job role, hire date, employment status, shift availability, training results, quiz answers and scores, certificates, policy acknowledgments, leave requests, retirement or resignation requests, incident reports the person filed, infraction cases and notes, performance reviews and 1:1 notes, uploaded documents and checklists. The Customer is the controller of this information. We process it only to provide the Service, as described in the <Link href="/legal/data-processing">Data Processing Addendum</Link>.</p>
      <p>If you are an employee, the <Link href="/legal/employee-notice">Employee Privacy Notice</Link> explains in plain language what your employer can see and what OnboardOps does.</p>
    </> },
    { title: "Profile information and photos", body: <p>You can choose a nickname and upload a profile picture in account settings. Pictures are cropped and shrunk in your browser before upload and stored in our database. They are visible only to you and to people who share a workplace with you, and you can remove them at any time. Your full name is used on records and in audit logs; your nickname is a display preference.</p> },
    { title: "Email addresses and verification", body: <p>Your account has a primary email address and may have additional addresses. We email a link to each address to confirm you control it, and we only use a confirmed address to sign you in or to match you to employer records. When an employer creates a record using your email, that record can be matched to your account only after you verify that address and choose to join. Removing an address stops it being used for those purposes.</p> },
    { title: "Sign-in links, sessions and security data", body: <p>We store one-way hashes of your password and of one-time links (sign-in, verification, invitation and password-reset links), together with when each was created, used or expired. We store counts of failed sign-in attempts and any temporary lockout. Sessions are held in signed, HTTP-only cookies. We keep a log of security-relevant events in the Workspace audit log, such as when a password was reset or when support access was used.</p> },
  ],
  "How we use information": [
    { title: "Automated rules and decisions", body: <>
      <p>The Service can apply rules that a Customer configures, such as enrolling a new hire in courses, marking a person certified after they pass required courses, assigning retraining after a written infraction, suspending an employee at a strike-point limit, expiring certificates and sending reminders. These rules are set by the Customer and apply the Customer&apos;s own criteria. OnboardOps does not make employment decisions, does not build profiles of individuals for its own purposes, and does not use Customer Data for automated decision-making of its own. Customers should review automated outcomes before relying on them.</p>
    </> },
    { title: "Legal bases for processing", body: <>
      <p>Where the law requires us to identify a legal basis for processing Personal Information, we rely on: performing our contract with you or with your organization (to provide the Service); our legitimate interests in securing the Service, preventing abuse and improving reliability, balanced against your rights; compliance with legal obligations; and consent, where we ask for it (for example, if we later add non-essential cookies).</p>
    </> },
  ],
  "Who we share information with": [
    { title: "Notifications you or your employer configure", body: <p>If an Owner or Admin connects a Discord or Slack webhook, the Service sends event summaries (for example a new hire, a certification or an infraction notice) to that destination. Confidential manager notes are not included. Once information is in a chat tool, the Customer&apos;s and the chat provider&apos;s policies apply. Email notifications go to the address on record for the recipient.</p> },
    { title: "Aggregated and de-identified information", body: <p>We may use counts and de-identified or aggregated information about how the Service is used (for example, the number of workspaces or how many quizzes were taken) to run and improve the Service and to report on it. We do not include employee names or content of records in aggregated information, and we do not attempt to re-identify it.</p> },
  ],
  "Security": [
    { title: "Security measures in more detail", body: <>
      <ul>
        <li><strong>Access control:</strong> every request is checked against the person&apos;s role on the server, and every record is scoped to its Workspace.</li>
        <li><strong>Credentials:</strong> passwords are hashed with bcrypt; one-time links are single-use, time-limited and stored only as hashes; sessions are signed and HTTP-only; repeated failed sign-ins cause a temporary lockout.</li>
        <li><strong>Confidential notes:</strong> removed on the server for roles that may not see them, and never included in notifications.</li>
        <li><strong>Files:</strong> served only through an authenticated route that checks the caller&apos;s role and the document&apos;s restriction.</li>
        <li><strong>Staff access:</strong> support access is read-only, time-limited, supervisor-level, announced to the Owner and logged. Staff accounts require a verified email.</li>
        <li><strong>Integrity:</strong> cases, timeline notes and audit entries are append-only, and audit entries are hash-chained.</li>
      </ul>
      <p>We are in beta and do not currently hold third-party security certifications. The <Link href="/security">Security page</Link> lists what is not yet available, including two-factor authentication.</p>
    </> },
    { title: "If something goes wrong", body: <p>If we confirm a breach of security that affects your Personal Information, we will tell you without undue delay, describe what happened and what we are doing, and notify authorities where the law requires. We will tell Customers about incidents affecting their Workspace data so they can meet their own obligations.</p> },
  ],
  "Your choices and rights": [
    { title: "Rights under U.S. state laws", body: <>
      <p>Residents of some states, including California, Colorado, Connecticut, Virginia and others, have rights to know, access, correct, delete and obtain a copy of their Personal Information, and to opt out of the sale or sharing of Personal Information and of targeted advertising or profiling. We do not sell or share Personal Information and do not engage in targeted advertising or profiling that produces legal effects, so there is nothing to opt out of. You may still ask to access, correct, delete or receive a copy of your Personal Information, and appeal a refusal, using the process above.</p>
      <p>Where an employer controls the information, we will tell you so and help you reach the right person, but we may not be able to act on that information ourselves.</p>
    </> },
    { title: "Visitors from outside the United States", body: <p>The Service is operated from and directed to the United States. If you use it from elsewhere, you do so on your own initiative and are responsible for compliance with local law. If the law of your country gives you additional rights, you may exercise them through the <C /> and we will respond as the law requires.</p> },
  ],
};

const aup: Extra = {
  "Fair and lawful use": [
    { title: "Examples of prohibited use", body: <>
      <Table head={["Do not", "For example"]} rows={[
        ["Misuse records", "Write a case that is untrue, exaggerated or unrelated to conduct; back-date entries; record something to pressure someone to resign or drop a complaint."],
        ["Retaliate", "Open a case against someone who filed an incident report, requested leave, raised a safety concern or asked for their records."],
        ["Discriminate or harass", "Use notes or reviews to record or act on protected characteristics, or to demean a person."],
        ["Over-collect", "Upload medical records, bank details, Social Security cards or photos of people's homes."],
        ["Misrepresent", "Impersonate OnboardOps staff, another user or another company, including on a custom domain."],
        ["Abuse access", "Give someone a higher role than they need, share logins, or look up records out of curiosity."],
      ]} />
    </> },
  ],
  "Security and system integrity": [
    { title: "Automated access and bulk actions", body: <p>Do not use scripts, bots or scrapers to access the Service, and do not send automated bulk requests, except through features we provide for that purpose (such as CSV import and export). Do not circumvent rate limits, lockouts, role checks or any other control, and do not attempt to read data belonging to another Workspace or user. Imports must contain only people the importing Customer has the right to record.</p> },
    { title: "Custom domains, emails and webhooks", body: <p>Do not use a custom domain, an email invitation or a webhook to send spam, phishing, malware or misleading content, or to impersonate another organization. Do not invite people who have not asked to be part of your workplace. Webhook destinations must be channels you control and that are limited to the people who should read the content.</p> },
  ],
  "Reporting violations": [
    { title: "How we handle reports", body: <p>We review reports as quickly as we reasonably can. We may ask for more information, restrict access while we investigate, and tell the relevant Customer. We will not reveal a reporter&apos;s identity to the person reported unless the law requires it or the reporter agrees. We do not retaliate against anyone who reports a violation in good faith.</p> },
  ],
};

const cookies: Extra = {
  "What we set": [
    { title: "Why we need them", body: <p>The sign-in cookie proves who you are on each request, and the workspace cookie remembers which of your workplaces you were using. Without them, you would be signed out on every page. We also record a short-lived support-access cookie for OnboardOps staff while they hold support access. The theme setting is purely a convenience so the site looks the way you chose.</p> },
    { title: "Cookies on custom domains", body: <p>If your employer has connected a custom domain, cookies for that site are set on that domain, not on onboardops.org. You will therefore sign in separately on each domain, and clearing cookies on one does not sign you out of the other.</p> },
  ],
  "Your choices": [
    { title: "Managing cookies in your browser", body: <p>Browsers let you view, block and delete cookies and site data. Typical steps are: open the browser&apos;s privacy or site-settings page, find onboardops.org (or your employer&apos;s domain), and clear its data. Blocking all cookies for the site will prevent you from signing in.</p> },
    { title: "Server logs and similar technology", body: <p>Our hosting infrastructure records standard request information (such as IP address, browser type, requested page and time) in server logs for security and reliability. Emails we send may use a unique link for sign-in, verification or invitation; we do not use tracking pixels in our emails.</p> },
  ],
};

const dpa: Extra = {
  "Scope and definitions": [
    { title: "Parties and processing roles", body: <p>For Customer Personal Information, the Customer is the controller (or &ldquo;business&rdquo;) and OnboardOps is the processor (or &ldquo;service provider&rdquo;). Where the Customer is itself a processor for its own clients, OnboardOps acts as a subprocessor and the Customer will ensure its instructions are consistent with its own obligations. For account-level information about the Customer&apos;s personnel, OnboardOps acts as an independent controller as described in the <Link href="/legal/privacy">Privacy Policy</Link>.</p> },
  ],
  "Assistance": [
    { title: "Requests from individuals", body: <p>If we receive a request from an individual about Customer Personal Information, we will not respond except to tell them to contact the Customer, unless the law requires otherwise. We will provide the Customer with reasonable tools and assistance, such as export features and printable records, to find, correct and delete information so the Customer can respond within the time the law allows.</p> },
    { title: "Impact assessments and regulators", body: <p>On request and at the Customer&apos;s cost where the work is substantial, we will give the Customer information reasonably needed for a data protection assessment, and reasonable help in dealing with a regulator about our processing under this DPA.</p> },
  ],
  "Return and deletion": [
    { title: "Deletion timeline", body: <p>After a Workspace is closed, we delete or de-identify its data from the live database promptly, and from backups on the provider&apos;s regular cycle, which we expect to complete within 35 days. If the law requires us to keep certain data, we will isolate it and protect it until it can be deleted. Details are in the <Link href="/legal/retention">Data Retention and Deletion Policy</Link>.</p> },
  ],
  "Security incidents": [
    { title: "Incident process", body: <p>On learning of an incident affecting Customer Personal Information, we will contain it, investigate, tell the Customer, share what we know and what we are doing, and cooperate with the Customer&apos;s reasonable requests. Our notice does not mean we accept fault. Notifications will go to the Owner contact in the Workspace.</p> },
  ],
};

const beta: Extra = {
  "It is a beta": [
    { title: "What may change", body: <p>During the beta we may change how features work, rename or remove them, change limits, reset test data, or change how sign-in works. We may also change these terms and policies as we learn. We will try to announce significant changes in the changelog, but we may make small changes without notice.</p> },
    { title: "Eligibility and invitations", body: <p>The beta is open to businesses and individuals who meet the age and authority requirements in the Terms of Service. We may limit participation, require an invitation, or remove participants at any time. Do not use the beta for anything where failure could cause serious harm.</p> },
  ],
  "Back up what matters": [
    { title: "Data during the beta", body: <p>Your data is yours, and we treat it with the same safeguards as in a released version. However, during the beta there is a higher risk of bugs, outages and data problems, and we may need to restore from backup or reset parts of the system. If that affects you, we will tell you what we know and help where we can, but we do not promise to recover every record.</p> },
  ],
  "Feedback": [
    { title: "Support and surveys", body: <p>We provide support by the contact form on a best-effort basis. We may email beta participants about the beta, such as asking for feedback or telling them about a change. You can tell us if you would rather not receive optional messages, though we will still send service messages needed to run your account.</p> },
  ],
};

export const EXTRA: Record<string, Extra> = { "terms-of-service": tos, privacy, "acceptable-use": aup, cookies, "data-processing": dpa, "beta-terms": beta };

/** Merges the extra sections into the base documents. */
export function extend(docs: Record<string, Doc>): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  for (const [slug, doc] of Object.entries(docs)) {
    const extra = EXTRA[slug];
    if (!extra) { out[slug] = doc; continue; }
    const sections: Section[] = [];
    for (const s of doc.sections) {
      sections.push(s);
      if (extra[s.title]) sections.push(...extra[s.title]);
    }
    out[slug] = { ...doc, sections };
  }
  return out;
}

/* ---------------- New documents ---------------- */
export const employeeNotice: Doc = {
  title: "Employee Privacy Notice",
  summary: "A plain-language guide for employees: what your employer can see, and what OnboardOps does.",
  short: "Your employer decides what to record about you and why. OnboardOps stores it and keeps it secure for them. You can see most of what is written about you, but managers can keep private notes. You have choices about your own account.",
  sections: [
    { title: "Who is responsible for what", body: <>
      <p>OnboardOps is software that your employer uses. <strong>Your employer decides what information to record about you and what to do with it.</strong> OnboardOps stores and processes that information on your employer&apos;s behalf, keeps it secure, and uses it only to run the service for them.</p>
      <p>OnboardOps also holds your own account information (your name, email addresses, password hash and profile), and is responsible for that under our <Link href="/legal/privacy">Privacy Policy</Link>.</p>
    </> },
    { title: "What your employer can record", body: <>
      <p>Depending on how your employer uses the service, records about you can include:</p>
      <ul>
        <li>Your name, contact details, emergency contact, job role, department, hire date and employment status.</li>
        <li>Training you were assigned, your quiz scores and certificates.</li>
        <li>Policies you were asked to sign, and when you signed them.</li>
        <li>Checklists you completed and incident reports you filed.</li>
        <li>Leave, retirement or resignation requests you made, and the decision.</li>
        <li>Warnings and other conduct records, including notes and your acknowledgment.</li>
        <li>Performance reviews and 1:1 notes, which a manager may or may not share with you.</li>
        <li>Documents your employer uploaded for you, such as licenses or signed forms.</li>
      </ul>
    </> },
    { title: "What you can and cannot see", body: <>
      <p>In your portal you can see your training, certificates, policies, checklists, requests, incident reports you filed, notices that need your signature, documents your employer chose to share and reviews that were shared with you.</p>
      <p>Managers can keep <strong>confidential notes</strong> on conduct cases and reviews that are not shown to you in the service. Employers may have separate legal obligations to show you or correct some records. If you think a record is wrong or you want a copy of your file, ask your employer directly. OnboardOps cannot decide that for them.</p>
    </> },
    { title: "What signing means", body: <p>When you sign a notice by typing your name, you are confirming that you received it. It is not an admission that it is true, and it is not agreement. The signature text says so. If you disagree, ask your manager to add your response, which can be recorded as an appeal on the case timeline.</p> },
    { title: "Who else can see your information", body: <>
      <p>Your employer decides who in the company can see what. In general: owners and admins see everything; managers see staff records, training, conduct and reviews; supervisors can see staff, training and cases but not confidential notes, documents or reviews; and employees see only their own information.</p>
      <p>OnboardOps staff cannot see your employer&apos;s data by default. If staff must look at a workspace to fix a problem, they need a written reason, the access is read-only, limited in time, visible to your employer, and logged.</p>
    </> },
    { title: "Reporting concerns safely", body: <p>You can file an incident report from your portal. Reports made in good faith, such as safety concerns, near misses and conduct concerns, must not be used against you, and our <Link href="/legal/acceptable-use">Acceptable Use Policy</Link> forbids employers from using the service to retaliate. If you think a record is being used to retaliate against you, you may also contact the relevant government agency or an attorney.</p> },
    { title: "Your own account", body: <>
      <p>You can create your own OnboardOps account, add more email addresses, set a nickname and picture, change your password or use email links to sign in. You control these in account settings. If you work for more than one employer, your account can show every workplace you belong to.</p>
      <p>When your employment ends, your employer may close your record and you lose access to their workplace. Your personal account stays open until you ask us to delete it.</p>
    </> },
    { title: "Questions and requests", body: <p>For questions about a record, talk to your manager or HR contact first. For questions about OnboardOps itself or your own account, use the <C /> and choose the topic that fits, such as &ldquo;Privacy request.&rdquo; We are based in the State of {SITE.state}, USA.</p> },
  ],
};

export const retention: Doc = {
  title: "Data Retention and Deletion Policy",
  summary: "How long we keep each kind of information and what happens when accounts or workspaces close.",
  short: "Customers decide how long to keep their records while a workspace is open. Closing a workspace deletes everything in it. Backups clear on a regular cycle. We keep only a small amount of operational data longer, for security and legal reasons.",
  sections: [
    { title: "Purpose and scope", body: <p>This policy explains how long OnboardOps keeps information and how it is deleted. It applies to information in the Service and to information about visitors and account holders. It works together with the <Link href="/legal/privacy">Privacy Policy</Link> and the <Link href="/legal/data-processing">Data Processing Addendum</Link>.</p> },
    { title: "Retention schedule", body: <Table head={["Information", "How long we keep it", "Notes"]} rows={[
      ["Workspace records (employees, courses, enrollments, checklists, policies, requests, documents)", "While the Workspace is open", "The Customer can edit or delete most of these. Deleting a document removes the file."],
      ["Infraction cases, timeline notes, audit entries", "While the Workspace is open", "Append-only by design; removed only when the Workspace is closed."],
      ["Account information", "While the account is open", "Deleted or de-identified after closure, subject to the exceptions below."],
      ["Additional email addresses", "Until you remove them", "Removed with the account."],
      ["Profile picture", "Until you remove it", "Removed with the account."],
      ["Password hashes and one-time link hashes", "Passwords until changed; links until used or expired", "Expired links are removed with the account."],
      ["Support messages and replies", "Up to 3 years after the last message", "Longer if needed to resolve a dispute or comply with law."],
      ["Email delivery log (recipient, subject, status)", "Up to 12 months", "Message bodies are not stored."],
      ["Staff activity log", "Up to 7 years", "Records who at OnboardOps did what; needed to show accountability."],
      ["Server and security logs", "Typically 30 days or less", "Longer if needed to investigate an incident."],
      ["Backups", "Cleared on the provider's cycle, within about 35 days", "Backups are not used to restore individual deleted items."],
    ]} /> },
    { title: "When a Workspace is closed", body: <p>When an Owner closes a Workspace, we permanently delete the Workspace and everything in it, including employee records, cases, notes, reviews, documents, policies, requests and the Workspace audit log. People who belong to no other Workspace have their login removed as well. Closing cannot be undone, and we recommend downloading an export first.</p> },
    { title: "When an account is deleted", body: <p>On a verified request, we delete the account&apos;s login, additional email addresses, profile picture, sign-in tokens, support messages and related email log entries. If the person is the only Owner of a Workspace, they must transfer ownership or close the Workspace first. Employee records that an employer created about the person belong to the employer and are unlinked from the deleted account, not deleted.</p> },
    { title: "Exceptions", body: <>
      <p>We may keep information longer than the schedule when we need to:</p>
      <ul><li>comply with a legal obligation, a court order or a valid legal hold;</li><li>establish, exercise or defend legal claims;</li><li>prevent fraud or abuse and protect the security of the Service; or</li><li>keep a minimal record that a deletion request was handled.</li></ul>
      <p>When we keep information for these reasons, we limit access to it and delete it when the reason ends.</p>
    </> },
    { title: "Customer responsibilities", body: <p>Customers are responsible for their own legal record-retention obligations, such as how long to keep personnel and training records under employment, safety and tax laws. The Service is not a substitute for a records-retention program. Customers should export and archive records they must keep before closing a Workspace or removing documents.</p> },
    { title: "Requests", body: <p>To ask about deletion or retention, use the <C /> and choose &ldquo;Privacy request.&rdquo; We will verify your identity, respond within the time the law allows, and tell you if we cannot fully act on a request and why.</p> },
  ],
};
