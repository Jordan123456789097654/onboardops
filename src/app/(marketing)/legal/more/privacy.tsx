import Link from "next/link";
import type { Section } from "../content";

const T = ({ head, rows }: { head: string[]; rows: string[][] }) => (
  <div className="mt-3 overflow-x-auto rounded-lg border border-line">
    <table className="w-full min-w-[520px] border-collapse text-left">
      <thead><tr>{head.map((h) => <th key={h} className="th !static !normal-case !tracking-normal">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`td align-top text-[13px] ${j === 0 ? "font-medium text-ink" : "text-soft"}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

export const privacyMore: Section[] = [
  { title: "Two roles: Customer data and our own data", body: <>
    <p>It helps to know which of two roles we have, because the rules differ.</p>
    <p><strong>When we act for a Customer.</strong> A Customer, usually an employer, puts information about its workforce into its Workspace. For that information, the Customer decides why and how it is used, and we process it on the Customer&rsquo;s behalf to run the Service. This is called Customer Data. The Customer is responsible for having a lawful reason to collect it, for telling its employees about it, and for answering requests about it. Our <Link href="/legal/data-processing">Data Processing Addendum</Link> and the <Link href="/legal/employee-notice">Employee Privacy Notice</Link> cover this role.</p>
    <p><strong>When we act for ourselves.</strong> We also hold information about people who visit our website, create accounts, contact us or use the Service. For that information, such as account details, security logs, support messages and billing in the future, we decide how it is used. This Privacy Policy mainly covers that role, and it also explains what happens to Customer Data inside our systems.</p>
    <p>If you are an employee and have a question about a record in your employer&rsquo;s Workspace, start with your employer. We will help you reach the right person and we will tell you what the software does, but we generally cannot decide what your employer records or keeps.</p>
  </> },
  { title: "Information by feature", body: <>
    <p>The table below describes, feature by feature, what information the Service handles. A Customer chooses which features to turn on, so a given Workspace may not use all of them.</p>
    <T head={["Feature", "What is handled", "Who sees it in the Workspace"]} rows={[
      ["Account and sign-in", "Name, nickname, email addresses, password hash, profile picture, sign-in times, and for each signed-in session a device label, approximate IP address and last-seen time.", "You. Customer Admins see your name and work email as a member."],
      ["Staff directory and employee record", "Name, staff ID, email, phone, emergency contact, department, job role, location, status, hire date, shift availability, and custom fields the Customer defines.", "Roles with permission to view employees."],
      ["Training", "Course assignments, lesson progress, quiz answers and scores, attempts, certificate codes, due dates.", "The employee and roles that manage training."],
      ["Infractions and appeals", "Case number, severity, points, policy cited, summary, evidence links, witness statements, the employee&rsquo;s written response, appeals and decisions, and an append-only timeline.", "Managers and above as the Customer configures. The employee sees the employee-visible parts."],
      ["Confidential manager notes and coaching notes", "Free-text notes written by managers.", "Only roles the Customer permits. Not shown to employees or supervisors."],
      ["Incident reports", "Type, time, place, description, optional photos, optional injury details, reviewer notes, investigator and due date, and the reporter&rsquo;s name unless the report is anonymous.", "Roles that review incidents. For anonymous reports the reporter is not recorded."],
      ["Checklists and handoff notes", "Items completed, notes, optional photos, who submitted and when, and verification.", "Staff roles, and the submitting employee."],
      ["Policies and sign-offs", "Policy text or a file or link, version, who signed which version, typed signature name and time.", "Roles that manage policies. Employees see their own."],
      ["Documents and credentials", "Uploaded files or links, titles, categories, expiry dates, license or certification details.", "The Customer decides which are restricted. Restricted items are limited to Owners and Admins."],
      ["Scheduling, swaps and time clock", "Shifts, swap requests, clock-in and clock-out times, notes.", "Managers, and the employee for their own."],
      ["Time off and leave", "Requests, dates, type, reasons, decisions, yearly allowances.", "Managers who decide requests, and the employee."],
      ["Reviews and one-to-ones", "Ratings, summaries and goals. Private notes stay private to the author&rsquo;s role.", "Managers, and the employee for items shared with them."],
      ["Equipment sign-out", "Items, who holds them, condition notes.", "Roles that manage assets."],
      ["Audit log", "Who did what, to which record and when, with a tamper-evident signature.", "Owners and Admins."],
      ["Notifications and email", "In-app alerts, email addresses, message subjects and delivery status, optional text messages if the Customer connects a provider and you opt in.", "You, and our staff for delivery troubleshooting."],
      ["Calendar feed", "A private link that lists your shifts and approved time off.", "Anyone you give the link to."],
    ]} />
  </> },
  { title: "Where information comes from", body: <>
    <ul>
      <li><strong>From you,</strong> when you create an account, fill in a form, upload a file, sign a policy, complete a checklist or training, or contact us.</li>
      <li><strong>From your employer,</strong> who enters and maintains records about you in the Workspace.</li>
      <li><strong>From your device and browser,</strong> such as IP address, browser type and the pages you request, which our hosting systems record.</li>
      <li><strong>From connected services,</strong> when a Customer connects another system, such as a human resources system, and chooses to bring in employee names, work emails, departments and job titles.</li>
      <li><strong>From our own systems,</strong> such as audit entries, security events, delivery results and rate-limit counters.</li>
    </ul>
  </> },
  { title: "Why we use information", body: <>
    <T head={["Purpose", "Examples"]} rows={[
      ["Provide the Service", "Show records to the right people, calculate training status and strike points, assign courses, send notifications you asked for, run the schedule and time clock."],
      ["Secure the Service", "Sign you in, detect repeated failed sign-ins and abuse, limit how often forms and endpoints can be used, email you about a sign-in from a new device, keep tamper-evident audit logs."],
      ["Support you", "Answer support requests, investigate problems, and, with limited and logged access, look at a Workspace when asked."],
      ["Communicate", "Send account emails such as verification, password reset, invitations and security notices, and notices about changes to the Service or these policies."],
      ["Improve the Service", "Understand which pages are used through cookie-free page counts, fix errors, and decide what to build from feedback and roadmap votes."],
      ["Meet legal duties", "Respond to lawful requests, keep records we must keep, enforce our terms and protect rights and safety."],
    ]} />
    <p>We do not use Customer Data to build advertising profiles, and we do not sell it. We do not use the content of employee records to train artificial intelligence models.</p>
  </> },
  { title: "Automated processing", body: <>
    <p>The Service applies rules that a Customer configures, such as assigning a remedial course, suspending an employee at a point threshold, escalating discipline under a rule, or letting points expire over time. These are the Customer&rsquo;s rules, applied automatically, and they can affect people at work. We do not make decisions about individuals for ourselves using this kind of automation. Where a Customer uses automation that affects employees, the Customer is responsible for telling them and for giving any review or appeal the law requires. The Service lets Customers provide an appeal process for cases.</p>
  </> },
  { title: "Employee records and sensitive information", body: <>
    <p>Some information in a Workspace can be sensitive, such as health or injury details in incident reports, details of disciplinary matters, leave reasons, work-authorization documents and emergency contacts. The Customer decides what to enter. We ask Customers to enter only what they need and to limit access. Our Acceptable Use Policy forbids using the Service to store certain kinds of data, such as Social Security cards, bank details and medical records, and the upload screens remind users of this.</p>
    <p>Restricted documents can be limited to Owners and Admins. Confidential notes are hidden from employees and supervisors. Anonymous incident reports do not store the reporter&rsquo;s identity. Even so, the Customer is responsible for its own handling of this information and for following the laws that apply to it.</p>
  </> },
  { title: "Who can see information inside a Workspace", body: <>
    <p>Visibility is controlled by roles and permissions that the Customer sets. In general, an employee sees their own record and the items shared with them. Supervisors, Managers, Admins and Owners see more, based on the role and any custom permissions. The Service checks these rules on the server. Our staff do not have a standing view into Workspaces. They can look only through time-limited, read-only support access that the Owner is told about and that appears in the Workspace audit log, or where the law requires.</p>
  </> },
  { title: "Service providers and subprocessors", body: <>
    <p>We use a small number of companies to run the Service. They may handle information only to provide their service to us, under terms that require them to protect it.</p>
    <T head={["Provider", "What it does", "Information involved"]} rows={[
      ["Vercel", "Hosts the website and application.", "Requests to the site, including IP address, and application data in transit."],
      ["Neon", "Managed PostgreSQL database that stores application data, including uploaded files.", "Customer Data and account data."],
      ["Resend", "Delivers email.", "Recipient email address, message subject and content."],
    ]} />
    <p>A Customer may also connect services that it chooses and pays for, such as a messaging provider for text messages, a human resources system, a chat tool for webhooks, or file services for links. Those are the Customer&rsquo;s choices and the Customer is responsible for them. When you connect one, information needed for that feature is sent to it. The current list of our own subprocessors is also in the Data Processing Addendum, and we will update it there if it changes.</p>
  </> },
  { title: "When we disclose information", body: <>
    <p>We disclose information only in these cases: to the Customer whose Workspace it belongs to; to our service providers as described above; when you ask us to; to respond to a valid legal demand, such as a subpoena or court order, after review; to protect the rights, safety or property of people or the Service; and in connection with a sale, merger or financing, in which case we will tell you and the new owner must honor this policy or give you a choice. We do not sell personal information and we do not share it for cross-context behavioral advertising.</p>
    <p>If we receive a legal demand for Customer Data, we will, unless the law prevents it, try to direct the requester to the Customer and tell the Customer so it can respond.</p>
  </> },
  { title: "Cookies, local storage and analytics", body: <>
    <p>We set only the cookies needed to sign you in and remember your active workspace, and we store your theme choice, the fact that you dismissed the cookie notice, and any checklist you finished while offline on your own device. A small service worker in the installed app caches site files so the app can open offline, and it does not store pages with your data. We count page views by page and by day without cookies and without recording who you are. We do not use advertising cookies or cross-site trackers. The <Link href="/legal/cookies">Cookie Policy</Link> has the full list. We treat a Global Privacy Control signal from your browser as a request to opt out of any sale or sharing, even though we do not sell or share.</p>
  </> },
  { title: "Security measures", body: <>
    <p>We use administrative, technical and physical safeguards that are reasonable for the sensitivity of the information. They include role checks on the server, workspace isolation in every query, hashed passwords, signed and HTTP-only session cookies, limits on repeated sign-in attempts and form submissions, security headers in your browser, encryption of credentials that Customers connect, hashed API keys, signed webhooks, time-limited and logged support access, and tamper-evident audit logs. The <Link href="/security">Security page</Link> lists these in more detail, including what we have not done yet. No system is perfectly secure. If a security incident affects your information, we will notify the affected Customers and, where the law requires, the people and authorities concerned, without unreasonable delay.</p>
  </> },
  { title: "How long we keep information", body: <>
    <T head={["Information", "How long"]} rows={[
      ["Customer Data in an active Workspace", "For as long as the Customer keeps the Workspace open, or until the Customer deletes the item where the Service allows deletion."],
      ["After a Workspace is closed", "Removed from the live database promptly, and from backups on the provider&rsquo;s regular cycle, which we expect to finish within 35 days. See the Data Retention and Deletion Policy."],
      ["Account information", "While your account is open and for a short period afterward to handle disputes and security. Deleted when you delete your account unless we must keep part of it by law."],
      ["Audit entries", "Kept with the Workspace for its life because the log is designed to be tamper-evident. Deleted when the Workspace is deleted."],
      ["Signed-in session records", "Recent sessions are shown in Account settings so you can end them. Session records are removed when the account is deleted."],
      ["Email delivery logs", "Kept for as long as needed to troubleshoot delivery and abuse."],
      ["Support messages", "Kept while needed to resolve the matter and for a reasonable time afterward."],
      ["Rate-limit counters", "Short-lived and removed automatically."],
      ["Page-view counts", "Aggregate counts by page and day, with no personal identifiers, kept in summary form."],
    ]} />
  </> },
  { title: "Your choices and how to use them", body: <>
    <p><strong>In your account.</strong> You can change your name, nickname and picture, add or remove email addresses, change your password, end your signed-in sessions, choose which optional emails you get, set quiet hours, turn a calendar link on or off, and opt in or out of text messages. You can download or delete your account information using the tools in Account settings.</p>
    <p><strong>By asking us.</strong> Use the contact form and choose the privacy request topic to ask for access, correction, deletion, a copy, or to object to a use. We confirm your identity, usually by matching your account email, and respond within the time the law requires, generally 45 days, which may be extended once. If we cannot fully act, we explain why.</p>
    <p><strong>Records held by your employer.</strong> Requests about records in a Workspace are usually for your employer. If you send one to us, we will help you reach the Customer and will not give Workspace records to anyone but the Customer without a lawful basis.</p>
    <p><strong>Appeals.</strong> If we decline a request, you may ask us to reconsider by replying and explaining why. Where the law gives you a right to appeal to a regulator, we will tell you how.</p>
    <p><strong>No retaliation.</strong> We will not treat you worse because you exercised a privacy right.</p>
  </> },
  { title: "Children and young workers", body: <>
    <p>You must be at least 13 to use the Service, and people under 18 need permission from a parent or guardian. We do not knowingly collect personal information from children under 13 and will delete it if we learn we have. Customers who employ people under 18 are responsible for following the laws that apply to young workers, including limits on hours and on the information they may collect.</p>
  </> },
  { title: "Notice for residents of certain U.S. states", body: <>
    <p>Some states give residents rights over their personal information, such as to know, access, correct, delete, and opt out of sale, sharing and targeted advertising. We do not sell personal information, do not share it for cross-context behavioral advertising, and do not use sensitive personal information to infer characteristics about you. Where you are in a state with these rights, you may use the process above to exercise them, and an authorized agent may submit a request for you with proof of authority. Georgia does not currently have a comprehensive consumer privacy statute, and we apply the same practices to everyone in the United States.</p>
  </> },
  { title: "Do Not Track and Global Privacy Control", body: <>
    <p>Some browsers send a Do Not Track signal. There is no common standard for responding to it. Because we do not track you across sites, our practices are the same whether or not the signal is on. We honor Global Privacy Control as an opt-out request where it applies.</p>
  </> },
  { title: "International users and transfers", body: <>
    <p>The Service is operated in the United States and information is processed there. If you use it from another country, your information will be transferred to the United States, which may have different data protection laws than your country. By using the Service you understand this. For Customers that need a data transfer mechanism, we offer the Data Processing Addendum.</p>
  </> },
  { title: "Changes to this policy", body: <>
    <p>We may update this policy as the Service or the law changes. We will post the new version with a new date. For material changes we will give notice in the Service or by email, at least 14 days before they take effect where practical.</p>
  </> },
  { title: "Common questions", body: <>
    <p><strong>Do you sell my data?</strong> No.</p>
    <p><strong>Can OnboardOps staff read my employer&rsquo;s records?</strong> Not routinely. Only through limited, logged, time-limited access, or where the law requires.</p>
    <p><strong>Who do I ask to correct something recorded about me at work?</strong> Your employer first. We can point you to the right person.</p>
    <p><strong>Can my employer find out who filed an anonymous report?</strong> The Service does not store who filed it. Your employer must not try to identify the reporter.</p>
    <p><strong>Do you use my data to train AI?</strong> No.</p>
    <p><strong>Where is my data stored?</strong> With our hosting and database providers in the United States.</p>
  </> },
  { title: "Website forms, lists and public lookups", body: <>
    <p>Some parts of our website collect small amounts of information without an account.</p>
    <ul>
      <li><strong>Waitlist and playbook list.</strong> If you give your email address to hear about releases or playbooks, we store the address and use it only for that. You can ask us to remove it.</li>
      <li><strong>Job applications and introductions.</strong> If you apply or introduce yourself on the Careers page, we store your name, email, any link you give and your message. Staff use it only to consider and reply to you. We do not collect files or ID numbers. You can ask us to delete it.</li>
      <li><strong>&ldquo;Was this helpful?&rdquo; on help articles.</strong> We store your yes or no and any comment, without your name or email, and use it to improve the guides.</li>
      <li><strong>Address check.</strong> The homepage box that checks whether a workspace address is free does not store what you type, other than ordinary short-lived rate-limit counters.</li>
      <li><strong>Referral codes.</strong> If you arrive through a partner link, we remember the partner&rsquo;s code on your device. If you then create a workspace, we record the code with the workspace so the partner can be credited.</li>
      <li><strong>Free tools.</strong> The tools on our website run in your browser. What you type is not sent to us. If you choose to save a draft, it stays on your device until you add it to a workspace.</li>
    </ul>
  </> },
  { title: "Training certificate lookups", body: <>
    <p>Anyone can enter a certificate code on our verification page to confirm that a training certificate is real. When a code matches, the page shows the name of the person it was issued to, the course, the employer&rsquo;s name and the dates. A Workspace owner can turn the name off for their workspace in Settings, in which case the page confirms only that the certificate is real. Lookups are limited per address to make it harder to guess codes. If you believe your certificate should not be shown, tell your employer or contact us.</p>
  </> },
];
