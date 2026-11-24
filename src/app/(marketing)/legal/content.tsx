import Link from "next/link";
import { SITE } from "@/lib/site";
import { extend, employeeNotice, retention } from "./content-extra";
import { moreSections } from "./more";

export type Section = { title: string; body: React.ReactNode };
export type Doc = { title: string; summary: string; short?: string; sections: Section[] };

const C = () => <Link href="/contact">contact form</Link>;
const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className="mt-3 overflow-x-auto rounded-lg border border-line">
    <table className="w-full min-w-[520px] border-collapse text-left">
      <thead><tr>{head.map((h) => <th key={h} className="th !static !normal-case !tracking-normal">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`td align-top text-[13px] ${j === 0 ? "font-medium text-ink" : "text-soft"}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

/* ------------------------------------------------------------------ */
const tos: Doc = {
  title: "Terms of Service",
  summary: "The agreement between you and OnboardOps for the workspace application.",
  short: "You can use OnboardOps if you are 13 or older. You own your data and are responsible for how you use it as an employer. The service is free and offered as-is during the beta. Georgia law applies. This summary is for convenience and is not part of the agreement.",
  sections: [
    { title: "Agreement and acceptance", body: <>
      <p>These Terms of Service (the &ldquo;Terms&rdquo;) are a binding agreement between you and {SITE.legalEntity} (&ldquo;OnboardOps,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo; or &ldquo;our&rdquo;), based in the State of Georgia, USA. They govern your access to and use of the OnboardOps web application, our APIs and related services (together, the &ldquo;Service&rdquo;).</p>
      <p>By creating an account, ticking the acceptance box, or using the Service, you agree to these Terms and to the documents they incorporate: the <Link href="/legal/privacy">Privacy Policy</Link>, the <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>, the <Link href="/legal/cookies">Cookie Policy</Link>, the <Link href="/legal/beta-terms">Beta Program Terms</Link> and, where it applies, the <Link href="/legal/data-processing">Data Processing Addendum</Link>. If you do not agree, do not use the Service.</p>
    </> },
    { title: "Definitions", body: <ul>
      <li><strong>Customer</strong> means the person or organization that creates or administers a Workspace. If you accept these Terms for an organization, Customer means that organization.</li>
      <li><strong>Workspace</strong> means the account space for one Customer, holding its employees, courses, cases, checklists and settings.</li>
      <li><strong>Users</strong> means anyone who accesses a Workspace, including Owners, Admins, Managers, Supervisors and Employees.</li>
      <li><strong>Customer Data</strong> means all information entered into or generated in a Workspace by or for the Customer, including employee records, training results, infraction cases, notes, checklists, evidence links and audit entries.</li>
      <li><strong>Personal Information</strong> means information that identifies or can reasonably be linked to an individual.</li>
      <li><strong>Beta</strong> means the period during which the Service is offered for testing and may change, as described in the Beta Program Terms.</li>
    </ul> },
    { title: "Eligibility", body: <>
      <p><strong>Minimum age.</strong> You must be at least 13 years old to create an account or use the Service. We do not knowingly allow anyone under 13 to use the Service.</p>
      <p><strong>Users under 18.</strong> If you are 13 or older but under 18 (the age of majority in Georgia), you may use the Service only with the permission of a parent or legal guardian, who agrees to these Terms on your behalf and is responsible for your use. You confirm that you have that permission by accepting these Terms.</p>
      <p><strong>Business use.</strong> The Service is designed for workplace record-keeping. If you accept these Terms for a company or other organization, you represent that you have authority to bind it. You may not use the Service if you are barred from receiving it under applicable law.</p>
    </> },
    { title: "Accounts, Workspaces and roles", body: <>
      <ul>
        <li>Provide accurate registration information and keep it up to date.</li>
        <li>Keep your credentials confidential. You are responsible for activity under your account, including by Users you invite, except where caused by our breach.</li>
        <li>The person who creates a Workspace is its Owner. The Owner and Admins decide who may access it and at what role. Roles control what each User may see and do, as described in the help center.</li>
        <li>Notify us promptly through the <C /> if you suspect unauthorized access.</li>
        <li><strong>Custom domains.</strong> If you connect a domain, you confirm you own or control it and will keep its DNS records correct. We may disconnect a domain that is misused or that points somewhere unsafe.</li>
        <li><strong>Employee accounts.</strong> A person may create their own account with a verified email. They only join a Workspace when the Customer has added an employee record with that verified email, or sends an invite.</li>
        <li>You may not share one login among several people, or create accounts by automated means.</li>
      </ul>
    </> },
    { title: "The Service and changes to it", body: <>
      <p>We provide the Service as described on our website and in the help center. We may add, change or remove features at any time. During the Beta this may happen frequently. If we make a change that materially reduces core functionality, we will try to give notice in the changelog or the Service.</p>
      <p>The Service includes automated rules that you configure, such as automatic retraining, suspension thresholds and certification when required courses are passed. These are conveniences. They do not replace human judgment, and you are responsible for reviewing their results.</p>
    </> },
    { title: "Customer Data", body: <>
      <h3>Ownership</h3>
      <p>As between you and us, you own Customer Data. We own the Service and everything in it other than Customer Data.</p>
      <h3>License to us</h3>
      <p>You grant us a worldwide, non-exclusive license to host, copy, process, transmit and display Customer Data only as needed to provide, secure, support and improve the reliability of the Service, to comply with law, and as described in the Privacy Policy. We do not sell Customer Data and do not use it for advertising.</p>
      <h3>Your responsibilities as the employer</h3>
      <p>You decide what to record and why. You are solely responsible for:</p>
      <ul>
        <li>having the right and a lawful basis to collect and store the information, and giving any notices or obtaining any consents the law requires;</li>
        <li>the accuracy, fairness and completeness of records, including infractions, notes and acknowledgments;</li>
        <li>complying with employment, anti-discrimination, anti-retaliation, wage-and-hour, child-labor, record-retention, privacy, recording and other laws that apply to you;</li>
        <li>choosing who in your organization may see confidential information, and assigning roles accordingly; and</li>
        <li>keeping copies of records you are legally required to keep. The Service is not a substitute for your own retention practices; and</li>
        <li>the content of documents, incident reports, reviews and 1:1 notes you create, including making sure employees receive any notice or access to records that the law requires.</li>
      </ul>
      <h3>Sensitive information</h3>
      <p>Do not enter more than you need. In particular, do not enter Social Security numbers, financial account numbers, government ID images, health or medical information or biometric data. See the <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>.</p>
      <h3>No legal or HR advice</h3>
      <p>OnboardOps is a record-keeping tool. Nothing in the Service or on our website is legal, HR or compliance advice, and using the Service does not make you compliant with any law. Consult a qualified attorney or HR professional.</p>
      <h3>Electronic acknowledgments</h3>
      <p>The Service lets employees type their name to acknowledge receipt of a notice and records a timestamp. We provide the mechanism only. We do not determine whether any acknowledgment satisfies a particular legal requirement, and acknowledging receipt is not an admission or agreement.</p>
    </> },
    { title: "Acceptable use and suspension", body: <>
      <p>You and your Users must follow the <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>. We may suspend or restrict access, with notice where practical, if we reasonably believe that use violates these Terms, poses a security risk, threatens other customers or the Service, or is required by law. We will lift the suspension once the issue is resolved.</p>
    </> },
    { title: "Third-party services", body: <p>The Service interoperates with third-party services, including infrastructure providers listed in our Privacy Policy and any Discord or Slack webhook you configure. We are not responsible for third-party services we do not control, and their terms govern your use of them. If you send Customer Data to a webhook or email address, you are responsible for that destination and for who can read it.</p> },
    { title: "Support", body: <p>Support is provided through the <C /> on a best-efforts basis during business hours (Monday to Friday, 9 am to 5 pm Eastern Time). Response targets in our <Link href="/support/support-policy">support policy</Link> are goals, not guarantees, and the Beta has no service-level agreement.</p> },
    { title: "Fees and the beta period", body: <p>The Service is currently free for beta testers. If we introduce paid plans, we will announce them in the changelog and give you reasonable advance notice. Paid terms would apply only if you choose a paid plan, and you will not be charged without your agreement.</p> },
    { title: "Intellectual property and feedback", body: <>
      <p>The Service, including its software, design, text, graphics and trademarks, belongs to OnboardOps and its licensors. We grant you a limited, non-exclusive, non-transferable, revocable right to use the Service for your internal business purposes under these Terms. You may not copy, modify, distribute, sell or lease any part of the Service, reverse engineer it, or use it to build a competing product, except where the law does not allow this restriction.</p>
      <p>If you send us feedback or suggestions, you grant us a perpetual, irrevocable, royalty-free license to use them without obligation to you.</p>
    </> },
    { title: "Privacy and security", body: <p>Our <Link href="/legal/privacy">Privacy Policy</Link> explains how we handle Personal Information, and our <Link href="/security">Security page</Link> describes the safeguards in place today and the ones that are not yet available. No system is perfectly secure, and you acknowledge that we cannot guarantee that Customer Data will never be accessed without authorization or lost.</p> },
    { title: "Term and termination", body: <>
      <ul>
        <li><strong>By you.</strong> You may stop using the Service at any time. To close a Workspace, contact us through the <C />.</li>
        <li><strong>By us.</strong> We may terminate or suspend access for material breach, legal requirement, or if we discontinue the Service or the Beta. Where practical we will give notice and a chance to export your staff directory.</li>
        <li><strong>Effect.</strong> When access ends, your right to use the Service ends. On request we will make a staff-directory export available. We will delete or de-identify Customer Data within a reasonable period, except where we must keep it by law or for legitimate security, fraud-prevention and backup purposes, in which case it stays protected until deleted on its regular cycle.</li>
        <li><strong>Survival.</strong> Sections that by their nature should survive will survive, including those on Customer Data responsibilities, intellectual property, disclaimers, limitation of liability, indemnification and governing law.</li>
      </ul>
    </> },
    { title: "Disclaimer of warranties", body: <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; PARTICULARLY DURING THE BETA. TO THE FULLEST EXTENT THE LAW ALLOWS, WE DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT DATA WILL NOT BE LOST. WE DO NOT WARRANT THAT USING THE SERVICE WILL MAKE YOU COMPLIANT WITH ANY LAW OR PRODUCE ANY PARTICULAR EMPLOYMENT OUTCOME.</p> },
    { title: "Limitation of liability", body: <>
      <p>TO THE FULLEST EXTENT THE LAW ALLOWS, ONBOARDOPS AND ITS OWNERS, OFFICERS, EMPLOYEES AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, GOODWILL OR DATA, ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS, WHETHER IN CONTRACT, TORT OR OTHERWISE, EVEN IF ADVISED OF THEIR POSSIBILITY.</p>
      <p>OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM AND (B) ONE HUNDRED U.S. DOLLARS ($100).</p>
      <p>These limits apply even if a remedy fails of its essential purpose. Some jurisdictions do not allow certain limits, so some of them may not apply to you. Nothing in these Terms limits liability that cannot be limited by law.</p>
    </> },
    { title: "Indemnification", body: <p>You will defend and indemnify OnboardOps and its owners, officers and employees against third-party claims, and resulting losses, damages and reasonable attorneys&apos; fees, arising from Customer Data, your employment decisions and practices, your Users&apos; use of the Service, or your breach of these Terms or the Acceptable Use Policy. We will notify you promptly of a claim, let you control the defense (we may participate with our own counsel at our expense), and you will not settle a claim that imposes obligations on us without our consent. This section does not apply to users under 18 to the extent the law does not permit it.</p> },
    { title: "Governing law, disputes and venue", body: <>
      <p>These Terms are governed by the laws of the State of Georgia, without regard to conflict-of-law rules, and by applicable U.S. federal law.</p>
      <p><strong>Informal resolution first.</strong> Before filing a claim, each party agrees to send written notice describing the dispute (through the <C /> for notices to us) and to try in good faith to resolve it for at least 30 days.</p>
      <p><strong>Venue.</strong> Any dispute not resolved informally will be brought exclusively in the state or federal courts located in Georgia, and each party consents to personal jurisdiction and venue there. Either party may seek urgent injunctive relief in any court of competent jurisdiction to protect confidential information or intellectual property.</p>
    </> },
    { title: "Electronic communications and notices", body: <p>You consent to receive notices and agreements electronically. We may give notice by posting in the Service, by email to your account address, or by updating this page. Notices to you are effective when sent. Notices to us must be sent through the <C /> and are effective when we receive them.</p> },
    { title: "Export and government use", body: <p>You may not use or export the Service in violation of U.S. export laws or sanctions. If the Service is used by or for a U.S. government entity, it is commercial computer software and related documentation provided with only the rights granted to other customers under these Terms.</p> },
    { title: "General", body: <ul>
      <li><strong>Changes to these Terms.</strong> We may update them by posting the new version with a new &ldquo;last updated&rdquo; date and, for material changes, giving notice in the Service or by email at least 14 days before they take effect where practical. Using the Service after the effective date means you accept the update. If you do not agree, stop using the Service.</li>
      <li><strong>Entire agreement.</strong> These Terms and the documents they reference are the whole agreement about the Service and replace earlier understandings about it.</li>
      <li><strong>Severability and waiver.</strong> If a provision is unenforceable, the rest stays in effect. Not enforcing a provision is not a waiver.</li>
      <li><strong>Assignment.</strong> You may not assign these Terms without our written consent. We may assign them in connection with a merger, acquisition or sale of assets.</li>
      <li><strong>Force majeure.</strong> Neither party is liable for failure or delay caused by events beyond its reasonable control.</li>
      <li><strong>Relationship.</strong> We are independent contractors. There are no third-party beneficiaries.</li>
      <li><strong>Interpretation.</strong> Headings are for convenience. &ldquo;Including&rdquo; means &ldquo;including without limitation.&rdquo;</li>
    </ul> },
    { title: "Contact", body: <p>Questions about these Terms: use the <C />. Legal notices should be marked &ldquo;Legal notice&rdquo; in the topic.</p> },
  ],
};

/* ------------------------------------------------------------------ */
const tou: Doc = {
  title: "Terms of Use",
  summary: "Rules for visiting and using the public OnboardOps website and help center.",
  short: "These cover the public website, help center and demo. Anyone 13 or older may browse. Content is general information, not advice. The Terms of Service cover the actual application.",
  sections: [
    { title: "Scope and relationship to other terms", body: <p>These Terms of Use apply to your use of the public OnboardOps website at onboardops.org, including the home, product, solutions, security, pricing, changelog, support, FAQ, about, contact and legal pages and the interactive demo (the &ldquo;Site&rdquo;). If you create an account and use the application, the <Link href="/legal/terms-of-service">Terms of Service</Link> also apply and control in a conflict.</p> },
    { title: "Acceptance and eligibility", body: <p>By accessing the Site you agree to these Terms of Use. You must be at least 13 years old to use the Site. If you are under 18, you should use it with a parent or guardian&apos;s permission. If you do not agree, please do not use the Site.</p> },
    { title: "Information on the Site", body: <p>Content on the Site is for general information about our product. We try to keep it accurate, but it may be out of date, and features described may change during the beta. Nothing on the Site is legal, employment, tax or compliance advice, and no attorney-client or advisory relationship is created by using the Site or contacting us.</p> },
    { title: "Demo, sample data and screenshots", body: <p>The interactive demo on the home page runs in your browser and saves nothing. Screenshots show a fictional demo workspace (&ldquo;Northside Supply &amp; Logistics&rdquo;). All names, cases and records shown are invented, and any resemblance to real people or companies is coincidental. Outcomes shown reflect how the product behaves, not a promise of results for your business.</p> },
    { title: "Intellectual property", body: <p>The Site&apos;s text, graphics, logos, screenshots, layout and code are owned by OnboardOps or its licensors and protected by copyright, trademark and other laws. You may view the Site and link to it. You may not copy, republish or distribute substantial parts of it, or use the OnboardOps name or logo in a way that suggests endorsement, without written permission.</p> },
    { title: "Messages you send us", body: <p>If you send a message through the contact form, you are giving us the information in it so we can respond. Do not include passwords, government ID numbers or full employee records. We handle messages as described in the <Link href="/legal/privacy">Privacy Policy</Link>. If you send feedback, you grant us the right to use it as described in the Terms of Service.</p> },
    { title: "Prohibited conduct", body: <ul>
      <li>Do not interfere with or disrupt the Site, or probe, scan or test its security without our written permission (see the safe-harbor guidance in the Acceptable Use Policy).</li>
      <li>Do not use bots, scrapers or other automated means to collect content at a rate that burdens the Site.</li>
      <li>Do not use the Site to violate any law or the rights of others, or to send spam or malware.</li>
      <li>Do not attempt to impersonate OnboardOps or its staff.</li>
    </ul> },
    { title: "Links and third parties", body: <p>The Site may link to third-party sites and services. We do not control them and are not responsible for their content or practices. A link is not an endorsement.</p> },
    { title: "Disclaimer and limitation of liability", body: <p>THE SITE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT THE LAW ALLOWS, ONBOARDOPS IS NOT LIABLE FOR DAMAGES ARISING FROM YOUR USE OF, OR INABILITY TO USE, THE SITE, AND ITS TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SITE IS LIMITED TO ONE HUNDRED U.S. DOLLARS ($100). Some jurisdictions do not allow certain limits, so some may not apply to you.</p> },
    { title: "Governing law", body: <p>These Terms of Use are governed by the laws of the State of Georgia, and disputes will be heard in the state or federal courts located in Georgia, as set out in the Terms of Service.</p> },
    { title: "Changes and contact", body: <p>We may revise these terms by posting an updated version here with a new date. Continued use after that date means you accept the update. Questions: use the <C />.</p> },
  ],
};

/* ------------------------------------------------------------------ */
const privacy: Doc = {
  title: "Privacy Policy",
  summary: "What we collect, why, who we share it with, and the choices you have.",
  short: "We collect what we need to run accounts and workspaces. We do not sell personal information, run ads or use third-party tracking. Employers control the employee records they enter. You can ask to access, correct or delete your information. This summary is for convenience and is not part of the policy.",
  sections: [
    { title: "Who this policy covers", body: <>
      <p>This Privacy Policy explains how OnboardOps (&ldquo;we,&rdquo; &ldquo;us&rdquo;), based in the State of Georgia, USA, handles Personal Information on our website (onboardops.org), help center and application. It applies to website visitors, people who create accounts, Users of a Workspace, and people who contact us.</p>
      <h3>Two different roles</h3>
      <p><strong>Account and website data.</strong> Information about visitors and the people who register or administer a Workspace. We decide how and why this is used (we are the &ldquo;controller&rdquo; or &ldquo;business&rdquo;).</p>
      <p><strong>Workspace data about employees.</strong> Information a Customer enters about its own staff. <strong>The Customer (the employer) decides how and why it is used, and we process it on the Customer&apos;s behalf</strong> as a processor or &ldquo;service provider&rdquo; under the <Link href="/legal/data-processing">Data Processing Addendum</Link>. If you are an employee and have questions about your record, contact your employer first. We may direct requests we receive about Workspace data to the relevant Customer.</p>
    </> },
    { title: "Information we collect", body: <>
      <Table head={["Category", "Examples", "Where it comes from"]} rows={[
        ["Account information", "Name, work email, password (stored only as a one-way hash), password-reset and invite tokens (stored only as hashes; they expire after 1 hour or 7 days and work once), workspace name, role", "You, or the administrator who created your login"],
        ["Workspace data", "Staff IDs, names, work email, phone, emergency contact, department, job role, hire date, status, strike points, shift availability, course progress and scores, certificate codes, infraction details, evidence links, notes, typed-name acknowledgments, checklist submissions, policy acknowledgments, incident reports, performance reviews and 1:1 notes, uploaded documents (for example policy PDFs, licenses and signed forms), in-app notifications, audit entries", "The Customer and its Users, and the Service as it applies the Customer's rules"],
        ["Support and contact messages", "Name, email, topic, message text, reference number", "You, through the contact form"],
        ["Verification and sign-in data", "Whether your email was verified, failed sign-in counts used to temporarily lock an account after repeated wrong passwords, and sign-in domains a customer connects", "Generated by the Service"],
        ["AI feature use", "Which AI feature was used, when, by whom, and how much text (counts only). We do not store the text sent to, or the draft received from, the AI provider; a draft exists only on your screen until you save it as your own content. Website chat messages are not stored by us except as described in the Website chat row.", "Generated by the Service"],
        ["Website chat and support handoff", "Questions asked in the OnboardOps chat bubble. If you ask for a person, the conversation and the name and email you give us become a support ticket, and replies are stored with it.", "You, or the visitor"],
        ["Two-factor authentication data", "Only if you turn it on: an authenticator secret (stored encrypted), backup codes (stored only as keyed hashes), a count of wrong codes used to temporarily lock two-factor sign-in, and the time of the last accepted code", "You, when you set it up"],
        ["Sign-in with Google or GitHub", "Only if you choose it: the provider's account ID, and your name and email address as the provider reports them (we require the provider to confirm the email is verified), and when you last used it. We never receive your Google or GitHub password.", "Google or GitHub, at your request"],
        ["Single sign-on (Customer-configured)", "Only if your employer turns it on: an account identifier from their company sign-in provider (Google Workspace or Microsoft Entra ID) and your email address", "Your employer's identity provider"],
        ["API keys and encryption key details (Customer admins)", "API key names, access levels, creation, expiry and last-use times (the key itself is stored only as a hash). If an Owner supplies their own encryption key: a short fingerprint, the version and dates. The key itself is kept only in encrypted form and only while it is active.", "Customer Owners and Admins"],
        ["Technical and usage data", "IP address, browser and device type, pages requested, timestamps, error logs", "Collected automatically by our hosting infrastructure"],
        ["Cookies and local storage", "Session and workspace cookies, theme preference", "Your browser, see the Cookie Policy"],
      ]} />
      <p>We do not intentionally collect sensitive categories such as Social Security numbers, financial account numbers, health data or biometric data, and our <Link href="/legal/acceptable-use">Acceptable Use Policy</Link> tells Customers not to enter them. We do not use advertising cookies, and at the time of writing we run no third-party analytics on the Service.</p>
    </> },
    { title: "How we use information", body: <ul>
      <li>To provide, maintain and secure the Service, including authentication and role-based access.</li>
      <li>To apply the rules a Customer configures, such as automatic enrollment, certification, retraining and suspension thresholds.</li>
      <li>To send notifications that you or your administrators set up, such as training assignments and infractions that need a signature, and service messages about your account.</li>
      <li>To respond to support requests, privacy requests and security reports.</li>
      <li>To detect, investigate and prevent abuse, fraud and security incidents, and to debug and improve reliability.</li>
      <li>To comply with law and enforce our terms.</li>
    </ul> },
    { title: "We do not sell your information", body: <p>We do not sell Personal Information and do not share it for cross-context behavioral advertising. We do not use Workspace data to build advertising profiles or to train advertising models.</p> },
    { title: "Who we share information with", body: <>
      <p>We share information only as follows:</p>
      <Table head={["Recipient", "Purpose", "What they may process"]} rows={[
        ["Vercel", "Application hosting and delivery", "All data in transit, request logs"],
        ["Neon", "Database hosting", "Account and Workspace data, support messages"],
        ["Resend", "Sending email notifications", "Recipient email, name and message content of notifications"],
        ["Groq (AI provider), added November 23, 2026", "Producing drafts when someone uses an AI feature, such as turning a pasted procedure into a course, and answering questions in the website chat", "The text or image a person submits to an AI feature, the chat questions visitors type, and, for signed-in users asking about their own account, their name, role, workspace name and their own support request summaries. Names, email addresses and phone numbers are removed first for features that read case or employee text. How long Groq keeps this text is set by Groq's own terms and privacy policy, which apply to its handling."],
        ["Google and GitHub (only if you choose to sign in with them)", "Signing you in", "Our servers exchange a one-time code with the provider and receive the profile described above. Nothing from your employer's records is sent to them. Their own privacy policies apply to what they do."],
        ["Discord, Slack or Microsoft Teams (Customer-configured)", "Webhook notifications the Customer's admin chooses to send", "Event summaries. Confidential manager notes are never included."],
        ["Professional advisers", "Legal, accounting and security advice", "Only what is needed, under confidentiality"],
        ["Authorities and counterparties", "Legal process, safety, or a merger or asset sale", "Only what is required, with notice where the law allows"],
      ]} />
      <p>These providers process data under contract and may only use it to provide services to us. Our subprocessor list is also in the <Link href="/legal/data-processing">Data Processing Addendum</Link>.</p>
      <h3>OnboardOps staff access</h3>
      <p>OnboardOps staff cannot open Workspace data by default. Staff access to a Workspace requires a written reason, is read-only at Supervisor level (no confidential manager notes, documents or reviews), lasts a few hours, notifies the Workspace owner, and is recorded in both the Workspace audit log and our own append-only staff log. Staff can see account-level information and counts (for example, sign-up dates and number of employees) to run the service and answer support requests.</p>
      <h3>Inside a Workspace</h3>
      <p>Access depends on role. Employees can see their own record without confidential manager notes. Supervisors cannot see confidential notes. Owners, Admins and Managers can. Performance reviews, 1:1 notes and private review notes follow the same rule, and employees only see entries a manager chooses to share. Restricted documents are visible only to Owners and Admins. Owners and Admins can view the full audit log.</p>
    </> },
    { title: "Cookies, Do Not Track and Global Privacy Control", body: <p>We use a small number of essential cookies and one browser-storage setting. See the <Link href="/legal/cookies">Cookie Policy</Link>. Because we do not sell or share Personal Information for advertising and do not track you across sites, there is nothing for a Do Not Track or Global Privacy Control signal to opt you out of, and we treat those signals as respected by design.</p> },
    { title: "How long we keep information", body: <>
      <Table head={["Data", "Retention"]} rows={[
        ["Account information", "While the account is active, then deleted or de-identified within a reasonable period after closure"],
        ["Workspace data", "While the Workspace is active. Infraction cases, timeline notes and audit entries are append-only and are not deleted through the product. After closure we delete or de-identify them within a reasonable period."],
        ["Support messages", "Up to 3 years after the last message, so we can handle follow-ups and recurring issues"],
        ["Server and security logs", "Typically 30 days or less, unless needed to investigate an incident"],
        ["Uploaded documents", "Until the Customer deletes them or closes the Workspace. Files are stored in the database and removed with it."],
        ["Password-reset and invite tokens", "Expire after 1 hour (reset) or 7 days (invite) and cannot be reused. They are removed when the account is deleted."],
        ["Two-factor secret and backup codes", "Until you turn two-factor authentication off, which deletes the secret and every backup code, or the account is deleted"],
        ["Connected Google or GitHub accounts and single sign-on identities", "Until you disconnect them, the Customer removes single sign-on, or the account is deleted"],
        ["API keys", "Kept (revoked keys stay listed with their dates) for the life of the Workspace. A revoked key stops working at once. Every change made through a key is recorded in the audit log."],
        ["Backups", "Deleted on the provider's regular backup cycle"],
      ]} />
      <p>We may keep information longer where the law requires it, for a legal claim, or to prevent fraud. Customers are responsible for their own legal record-retention obligations.</p>
    </> },
    { title: "Security", body: <p>We use measures including hashed passwords, optional two-factor authentication that a Workspace owner can require, signed HTTP-only session cookies, server-side role checks, workspace-level data isolation, field-level encryption of sensitive records with an optional customer-supplied key, scoped and revocable API keys, and HTTPS. The <Link href="/security">Security page</Link> lists what is and is not in place. No method of transmission or storage is perfectly secure, so we cannot guarantee absolute security. If we learn of a breach affecting your information, we will notify you and, where applicable, regulators as the law requires.</p> },
    { title: "Your choices and rights", body: <>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>know what Personal Information we hold about you and receive a copy;</li>
        <li>correct inaccurate information;</li>
        <li>delete your information, subject to legal exceptions;</li>
        <li>receive your information in a portable format;</li>
        <li>object to or limit certain uses; and</li>
        <li>not be discriminated against for exercising these rights.</li>
      </ul>
      <p><strong>How to ask.</strong> Use the <C /> and choose &ldquo;Privacy request.&rdquo; For Workspace data about an employee, please ask the employer first, because they control it. We will confirm your identity (for example by matching your account email), respond within the time the law requires (generally 45 days, extendable once), and explain if we cannot fully act on a request. You may use an authorized agent, who must show written permission. If we decline a request, you may appeal by replying to our decision, and we will have a different person review it.</p>
      <p><strong>Georgia and other U.S. residents.</strong> Georgia does not currently have a comprehensive consumer privacy statute. We apply the choices described here to all U.S. users.</p>
    </> },
    { title: "Notice for California residents", body: <>
      <p>For the past 12 months, we collected the categories of Personal Information in the table in section 2 (identifiers such as name and email; internet activity such as IP address and logs; and, for Workspace data, employment-related information entered by the Customer). We collected it from you, from your administrators and automatically, for the business purposes in section 3. We disclosed it to the service providers in section 5 for those purposes. We do not sell or share Personal Information as those terms are defined by California law, and we do not knowingly sell or share the Personal Information of anyone under 16. You may exercise your California rights using the process in section 9.</p>
    </> },
    { title: "Children", body: <p>The Service is not directed to children under 13, and we do not knowingly collect Personal Information from them. You must be at least 13 to create an account. If you are under 18, you need a parent or guardian&apos;s permission as described in the Terms of Service. If we learn we collected information from a child under 13, we will delete it. Parents who believe their child under 13 has provided information can contact us through the <C />. Customers may employ people who are 13 or older only where the law allows and are responsible for complying with child-labor and other laws that apply to those records.</p> },
    { title: "International transfers", body: <p>We operate from the United States, and our providers may process information in the United States and other countries where they operate. By using the Service you understand your information may be transferred to and stored in those places, which may have different data-protection rules than your own.</p> },
    { title: "Changes to this policy", body: <p>We will post updates here with a new date and, for material changes, give notice in the Service or by email. The version in effect is the one on this page.</p> },
    { title: "Contact", body: <p>For privacy questions or requests, use the <C /> and choose &ldquo;Privacy request.&rdquo; We are based in the State of Georgia, USA.</p> },
  ],
};

/* ------------------------------------------------------------------ */
const aup: Doc = {
  title: "Acceptable Use Policy",
  summary: "What you may and may not do with the Service.",
  short: "Use OnboardOps honestly and fairly, record only what you need, never discriminate or retaliate, and do not attack or abuse the service. Security researchers are welcome if they follow the safe-harbor rules.",
  sections: [
    { title: "Purpose", body: <p>This policy is part of the <Link href="/legal/terms-of-service">Terms of Service</Link> and applies to everyone who uses OnboardOps. Because the Service stores records about real people and can affect their jobs, we hold it to a high standard.</p> },
    { title: "Fair and lawful use", body: <>
      <p>You may not use the Service to:</p>
      <ul>
        <li>discriminate against, harass, intimidate or retaliate against any person, or record decisions based on a protected characteristic;</li>
        <li>retaliate against someone for reporting a safety concern, filing a complaint, or exercising a legal right (for example, using a record to punish stop-work reports);</li>
        <li>create false, fabricated or misleading records, or alter the record to mislead. Corrections must be added as new notes;</li>
        <li>use incident reports, performance reviews or 1:1 notes to target, intimidate or retaliate against someone, or to record decisions based on a protected characteristic;</li>
        <li>violate any law, including employment, privacy, recording, child-labor and wage laws; or</li>
        <li>monitor or collect information about people who are not your employees, contractors or other staff.</li>
      </ul>
    </> },
    { title: "Data minimization: what not to enter", body: <>
      <p>Keep only what you need for training, conduct and shift records. Do not enter:</p>
      <ul>
        <li>Social Security numbers or other government ID numbers. Images of identity or work-authorization documents may be uploaded only where the law requires you to keep them (for example Form I-9 documents) and only as <strong>Restricted</strong> documents, which only Owners and Admins can open;</li>
        <li>bank, card or other financial account numbers;</li>
        <li>medical, health, disability, genetic or biometric information, or details of a protected leave beyond the fact that a person is on leave. Do not upload medical records as documents;</li>
        <li>immigration status details, union activity, or political or religious beliefs; or</li>
        <li>information about children under 13.</li>
      </ul>
      <p>Evidence links should point to material you are entitled to hold. Do not link to illegal content or content that infringes others&apos; rights.</p>
    </> },
    { title: "Responsibility of employers", body: <ul>
      <li>Give your staff any notice about record-keeping that the law or your policies require.</li>
      <li>Limit confidential manager notes to what is necessary and fair, and do not use them to hide information the employee is entitled to receive.</li>
      <li>Give each person only the role they need, and review roles regularly.</li>
      <li>Make sure documented discipline is accurate and applied consistently.</li>
    </ul> },
    { title: "Security and system integrity", body: <>
      <p>You may not:</p>
      <ul>
        <li>share logins, or create accounts by automated means;</li>
        <li>upload malware, or attempt to disrupt, overload or gain unauthorized access to the Service, other accounts or our systems;</li>
        <li>scrape the Service, or use it to build a competing product; or</li>
        <li>bypass or attempt to bypass role checks, rate limits or other safeguards.</li>
      </ul>
    </> },
    { title: "Security research and safe harbor", body: <>
      <p>We welcome good-faith reports of vulnerabilities. If you follow these rules, we will not pursue legal action against you for your research:</p>
      <ul>
        <li>Test only against accounts you own or have permission to use. Do not access, change or delete other customers&apos; data.</li>
        <li>Do not degrade the Service (no denial-of-service, spam or social engineering of our staff or customers).</li>
        <li>Stop and report right away if you reach personal information, and do not keep or share it.</li>
        <li>Report through the <Link href="/contact">contact form</Link> with the topic &ldquo;Security report,&rdquo; with steps to reproduce, and give us reasonable time to fix the issue before disclosing it.</li>
      </ul>
    </> },
    { title: "Reporting violations", body: <p>Report suspected violations through the <Link href="/contact">contact form</Link>. If you believe someone is in immediate danger, contact local emergency services first.</p> },
    { title: "Enforcement", body: <>
      <p>We may investigate suspected violations and may remove content, restrict features, suspend or terminate accounts. Depending on the severity we may:</p>
      <ul><li>send a warning and ask you to correct the issue;</li><li>temporarily restrict features or access;</li><li>suspend or terminate the account; and</li><li>report unlawful conduct to authorities.</li></ul>
      <p>We will try to give notice and a chance to respond where practical, but may act immediately to protect people or the Service. You can appeal a decision by replying to our notice, and a different person will review it.</p>
    </> },
    { title: "Changes", body: <p>We may update this policy by posting a new version with a new date.</p> },
  ],
};

/* ------------------------------------------------------------------ */
const cookies: Doc = {
  title: "Cookie Policy",
  summary: "The few cookies and browser-storage items we use.",
  short: "We use only the cookies the app needs to keep you signed in, plus a theme preference stored on your device. No advertising or third-party tracking cookies.",
  sections: [
    { title: "What cookies and similar technologies are", body: <p>Cookies are small text files a website stores in your browser. We also use browser local storage, which works similarly but stays on your device. We keep both to a minimum.</p> },
    { title: "What we set", body: <Table head={["Name", "Type", "Purpose", "Lifetime"]} rows={[
      [<span key="a" className="mono">oo_session</span>, "Strictly necessary cookie", "Keeps you signed in. Signed, HTTP-only and sent only over HTTPS in production.", "Up to 14 days"],
      [<span key="b" className="mono">oo_ws</span>, "Strictly necessary cookie", "Remembers which workspace is active.", "Up to 90 days"],
      [<span key="mfa" className="mono">oo_mfa</span>, "Strictly necessary cookie", "Set only between entering your password and entering your two-factor code. It is not a sign-in and is rejected as one.", "5 minutes"],
      [<span key="oauth" className="mono">oo_oauth</span>, "Strictly necessary cookie", "Set only while you sign in with Google or GitHub. Holds a one-time value that protects the sign-in against forgery.", "10 minutes"],
      [<span key="sso" className="mono">oo_sso</span>, "Strictly necessary cookie", "Set only while you sign in through your company&apos;s single sign-on. Holds a one-time value that protects the sign-in against forgery.", "10 minutes"],
      [<span key="c" className="mono">oo-theme</span>, "Local storage (functional)", "Remembers your light, system or dark theme. Stays on your device and is not sent to us.", "Until you clear it"],
    ]} /> },
    { title: "What we do not use", body: <p>We do not use advertising cookies, cross-site tracking, social-media tracking pixels or third-party analytics cookies. Our hosting infrastructure keeps ordinary server logs (such as IP address and pages requested) for security and reliability, as described in the <Link href="/legal/privacy">Privacy Policy</Link>.</p> },
    { title: "Your choices", body: <p>The sign-in and workspace cookies are strictly necessary, so the application will not work without them, and consent is not required for them. You can clear or block cookies and local storage in your browser settings, but you will be signed out and your theme will reset. Most browsers let you review and delete cookies from their settings page.</p> },
    { title: "Changes", body: <p>If we add analytics or other non-essential cookies, we will update this policy and ask for your consent where the law requires before setting them.</p> },
  ],
};

/* ------------------------------------------------------------------ */
const dpa: Doc = {
  title: "Data Processing Addendum",
  summary: "How we process employee data on behalf of customers.",
  short: "You decide what employee data to enter and why. We process it only to run the Service for you, keep it secure, use listed subprocessors, tell you promptly about breaches, and delete it when you leave.",
  sections: [
    { title: "Scope and definitions", body: <>
      <p>This Data Processing Addendum (&ldquo;DPA&rdquo;) forms part of the <Link href="/legal/terms-of-service">Terms of Service</Link> between the Customer and OnboardOps (&ldquo;Provider&rdquo;) and applies to Personal Information in Customer Data that the Provider processes on the Customer&apos;s behalf. Terms such as &ldquo;controller,&rdquo; &ldquo;processor,&rdquo; &ldquo;business,&rdquo; &ldquo;service provider,&rdquo; &ldquo;processing&rdquo; and &ldquo;personal information&rdquo; have the meanings given in applicable data-protection law. If a conflict arises, this DPA controls for the processing it covers, and the Terms control otherwise.</p>
    </> },
    { title: "Roles", body: <p>The Customer determines the purposes and means of processing employee data (controller or business). The Provider processes it only to provide the Service (processor or service provider).</p> },
    { title: "Instructions and restrictions", body: <>
      <p>The Provider will process Customer Personal Information only on the Customer&apos;s documented instructions, which are the Terms, this DPA, and the Customer&apos;s configuration and use of the Service. The Provider will not:</p>
      <ul><li>sell or share the information;</li><li>retain, use or disclose it for any purpose other than providing the Service (including any commercial purpose of its own), except as the law permits; or</li><li>combine it with other information, except as the law permits.</li></ul>
      <p>The Provider will tell the Customer if it believes an instruction violates applicable law.</p>
    </> },
    { title: "Confidentiality of personnel", body: <p>Personnel with access to Customer Data are bound by confidentiality obligations and are given access only as needed to operate, secure and support the Service.</p> },
    { title: "Security", body: <p>The Provider maintains technical and organizational measures appropriate to the risk, listed in Annex II, and will not materially reduce them during the term.</p> },
    { title: "Subprocessors", body: <>
      <p>The Customer authorizes the subprocessors in Annex III. The Provider will bind each to data-protection terms at least as protective as this DPA and remains responsible for their performance. The Provider will post changes to the list here, and the Customer may object on reasonable data-protection grounds by contacting us through the <C /> within 14 days of the change. If the parties cannot resolve the objection, the Customer may stop using the affected part of the Service.</p>
      <p>Sign-in services that the Customer or its Users choose to use, such as Google, GitHub, Microsoft Entra ID or the Customer&apos;s own identity provider, act for themselves or for the Customer and are not subprocessors. The Provider sends them no Workspace data. They receive the sign-in request, and the Provider receives the account identifier, name and email address they report.</p>
    </> },
    { title: "Assistance", body: <p>Taking into account the nature of the Service, the Provider will reasonably help the Customer respond to requests from individuals to exercise their rights, and with security, breach-notification and impact assessments, at the Customer&apos;s request. The Customer can use features such as CSV export and printable dossiers to retrieve data. Reasonable additional assistance may be limited where it would require disproportionate effort.</p> },
    { title: "Security incidents", body: <p>The Provider will notify the Customer without undue delay after becoming aware of a confirmed breach of security that leads to unauthorized access to Customer Personal Information, and will provide information reasonably available to help the Customer meet its own notification duties, including the nature of the incident, likely consequences and steps taken.</p> },
    { title: "Return and deletion", body: <p>On termination, the Provider will, at the Customer&apos;s request, make a staff-directory export available, and will then delete or de-identify Customer Personal Information within a reasonable period, except where retention is required by law. Backups are deleted on their regular cycle. Infraction cases, timeline notes and audit entries are append-only within the product, and are removed as part of workspace deletion.</p> },
    { title: "Audits and information", body: <p>On reasonable written request, no more than once a year, the Provider will provide information needed to demonstrate compliance with this DPA. Because the Service is in beta, the Provider does not currently hold third-party audit certifications, and says so on its <Link href="/security">Security page</Link>.</p> },
    { title: "International transfers", body: <p>The Provider and its subprocessors operate primarily in the United States. Where the law requires a transfer mechanism for personal information from another country, the parties will agree one in good faith before such a transfer occurs.</p> },
    { title: "Customer responsibilities", body: <p>The Customer is responsible for the lawfulness of the data it enters, for notices and consents owed to its staff, for the accuracy of its records, and for using only the access and roles it needs. See the Customer Data section of the Terms and the <Link href="/legal/acceptable-use">Acceptable Use Policy</Link>.</p> },
    { title: "Liability and governing law", body: <p>Each party&apos;s liability under this DPA is subject to the limits in the Terms. This DPA is governed by the laws of the State of Georgia, subject to any mandatory law that applies to the data.</p> },
    { title: "Annex I: Details of processing", body: <Table head={["Item", "Description"]} rows={[
      ["Subject matter", "Hosting and operation of the OnboardOps workforce records, training and discipline service"],
      ["Duration", "The term of the Customer's use of the Service, plus the deletion period above"],
      ["Nature and purpose", "Storing, retrieving, displaying, applying configured rules to, exporting, emailing and transmitting to configured webhooks the Customer's workforce records"],
      ["Data subjects", "The Customer's employees, contractors and other staff, and the Users it invites"],
      ["Types of personal information", "Name, work email, phone, emergency contact, staff ID, department, job role, hire date, status, shift availability, training and quiz results, infraction and disciplinary records, notes, typed-name acknowledgments, policy acknowledgments, incident reports, performance reviews and 1:1 notes, uploaded documents, checklist submissions, notifications, audit entries, login credentials (hashed), two-factor authentication data (encrypted secret, hashed backup codes), linked sign-in provider and single sign-on identifiers, API key records (hashed), password-reset tokens (hashed) and session data"],
      ["Sensitive data", "None intended. Customers must not enter sensitive categories (see the Acceptable Use Policy)."],
    ]} /> },
    { title: "Annex II: Security measures", body: <ul>
      <li>Passwords stored only as bcrypt hashes; signed, HTTP-only session cookies.</li>
      <li>Server-side role-based access checks on every action; confidential notes removed server-side for non-manager roles.</li>
      <li>Workspace identifier on every record and every query to isolate customers.</li>
      <li>Append-only history for cases, timeline notes and audit entries, with hash-chained audit entries.</li>
      <li>HTTPS in transit. Sensitive record fields and uploaded files are encrypted with AES-256-GCM before they are stored, under a separate key for each Workspace that is itself protected by a master key held outside the database. At the Customer's option the Workspace key can instead be protected by a key the Customer supplies; revoking that key locks the Workspace&apos;s encrypted records until it is provided again. Other data relies on encryption at rest provided by the database and hosting providers.</li>
      <li>Optional two-factor authentication (authenticator-app codes and single-use backup codes) that a Workspace Owner can require for every member. Secrets are stored encrypted, backup codes only as keyed hashes, a code cannot be used twice, and repeated wrong codes lock two-factor sign-in for 15 minutes.</li>
      <li>Optional single sign-on through the Customer&apos;s Google Workspace or Microsoft Entra ID, and optional sign-in with Google or GitHub. Provider responses are verified (signature, audience, expiry, one-time value and state), and access is granted only to people who already hold an account and a membership in the Workspace.</li>
      <li>AI features in the Service are on by default and a workspace Owner or Admin can turn them off. Most are limited per person and per workspace. The website chat is not limited per person. The AI sends only the text the user submits, the chat questions a visitor types, and, for a signed-in user asking about their own account, that user's own name, role, workspace name and own support request summaries. For features that read case or employee text, names and contact details are removed first. The AI returns a draft that a person reviews, makes no decision about any employee, and changes no record by itself. Use is counted and audit-logged without the text.</li>
      <li>API keys with separate read and write scopes, stored only as hashes and revocable at any time. Changes made through a key are limited by the role of the person who created it and are recorded in the audit log.</li>
      <li>Notifications exclude confidential manager notes.</li>
      <li>Uploaded files are served only through an authenticated route that checks the caller's role and the document's restriction, with no-store caching and sandboxing headers.</li>
      <li>Password-reset and invite tokens are single-use, time-limited and stored only as hashes. Changing a password signs out other sessions.</li>
      <li>Access to production systems limited to personnel who need it.</li>
    </ul> },
    { title: "Annex III: Subprocessors", body: <Table head={["Subprocessor", "Service", "Location"]} rows={[
      ["Vercel Inc.", "Application hosting and delivery", "United States and global edge network"],
      ["Neon, Inc.", "Managed Postgres database hosting", "United States (region as configured)"],
      ["Groq, Inc. (added November 23, 2026)", "AI text, image and speech processing for AI features and the website chat. Receives only the content described in the AI features section of the Privacy Policy: what a user submits to an AI feature, visitor chat questions, and a signed-in user's own account facts for account questions.", "United States (the provider's processing locations are set by the provider)"],
      ["Resend", "Transactional email delivery", "United States"],
    ]} /> },
  ],
};

/* ------------------------------------------------------------------ */
const beta: Doc = {
  title: "Beta Program Terms",
  summary: "What to expect while OnboardOps is in beta.",
  short: "OnboardOps is a free beta. It can change, have bugs or downtime, and data may be reset, so keep your own copies of anything critical. We would love your feedback.",
  sections: [
    { title: "Relationship to the Terms of Service", body: <p>OnboardOps is currently in a free beta. These terms add to the <Link href="/legal/terms-of-service">Terms of Service</Link> and apply while you use the beta. If they conflict, these Beta Program Terms control for the beta.</p> },
    { title: "It is a beta", body: <p>Features may be incomplete, change, be renamed, or be removed. The Service may have bugs and downtime, and we offer no uptime commitment or service-level agreement. We may limit the number of beta users or features at any time.</p> },
    { title: "Back up what matters", body: <p>We work to avoid data loss, but during the beta data may be lost, corrupted, or need to be reset. Keep your own copy of critical records. You can export the staff directory to CSV and print dossiers and certificates to PDF. Do not rely on the beta as your only system of record for documents you are legally required to keep.</p> },
    { title: "Free of charge", body: <p>The beta is free. We will not start charging without your agreement to a paid plan, and we will announce any pricing in the changelog first.</p> },
    { title: "Feedback", body: <p>We welcome feedback and bug reports. You grant us a perpetual, irrevocable, royalty-free license to use them to improve the Service, without attribution or payment, as stated in the Terms of Service. Do not include confidential employee information in feedback.</p> },
    { title: "Confidentiality of unreleased features", body: <p>If we show you a feature that is not publicly announced and ask you to keep it confidential, please do so. This does not apply to information you already knew, that becomes public through no fault of yours, or that you are legally required to disclose.</p> },
    { title: "Ending the beta or your access", body: <p>Either of us may end your participation at any time. We will try to give reasonable notice and a chance to export your data before the beta ends. When the beta ends, we will tell you what happens to existing workspaces.</p> },
    { title: "Warranty and liability", body: <p>The beta is provided &ldquo;as is.&rdquo; The disclaimers and limitations in the Terms of Service apply in full, and our total liability for the free beta is limited to the amount stated there.</p> },
  ],
};

const base: Record<string, Doc> = {
  "terms-of-service": tos, "terms-of-use": tou, privacy, "acceptable-use": aup, cookies, "data-processing": dpa, "beta-terms": beta,
};

const combined: Record<string, Doc> = { ...extend(base), "employee-notice": employeeNotice, retention };
export const legalDocs: Record<string, Doc> = Object.fromEntries(
  Object.entries(combined).map(([slug, d]) => [slug, { ...d, sections: [...d.sections, ...(moreSections[slug] ?? [])] }]),
);
