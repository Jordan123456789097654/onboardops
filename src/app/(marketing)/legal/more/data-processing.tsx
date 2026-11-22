import Link from "next/link";
import type { Section } from "../content";

export const dpaMore: Section[] = [
  { title: "Purpose and structure of this Addendum", body: <>
    <p>This Data Processing Addendum (the &ldquo;DPA&rdquo;) forms part of the Terms of Service between the Customer and OnboardOps (the &ldquo;Provider&rdquo;). It applies when the Provider processes Personal Information in Customer Data on behalf of the Customer. It describes how the Provider handles that information, what each side must do, and what the Customer can expect.</p>
    <p>The DPA is organized as follows: the main sections state the roles and duties; Annex I describes the processing; Annex II lists the security measures; Annex III lists the subprocessors. The sections below add detail on how the Provider carries out these duties in practice. If something here conflicts with the Terms on the subject of processing personal data for the Customer, this DPA controls for that subject.</p>
  </> },
  { title: "Description of the processing in practice", body: <>
    <p><strong>Subject matter.</strong> Providing a hosted workforce records and training application to the Customer.</p>
    <p><strong>Nature of processing.</strong> Collecting, recording, organizing, storing, retrieving, displaying, transmitting by email and other channels the Customer configures, exporting, and deleting information, and applying automatic rules that the Customer configures.</p>
    <p><strong>Purpose.</strong> To run the Service for the Customer, to keep it secure, to support the Customer, and to meet legal duties, and for no other purpose of the Provider&rsquo;s own except as these documents allow.</p>
    <p><strong>Duration.</strong> For as long as the Customer&rsquo;s Workspace is open, and afterward only for the short period needed to complete deletion as described in the Data Retention and Deletion Policy.</p>
    <p><strong>Categories of people.</strong> The Customer&rsquo;s employees, former employees and job candidates it chooses to record, its managers and administrators, their emergency contacts, and people named in cases, incident reports, witness statements or documents.</p>
    <p><strong>Categories of information.</strong> Identity and contact details, employment details such as job role and department, training and certification records, attendance, time and scheduling records, disciplinary and appeal records, incident and safety records, leave and time-off records, credentials and licenses, documents and links the Customer attaches, notification preferences, and account and security records for users. The Customer controls which of these it enters.</p>
    <p><strong>Sensitive information.</strong> The Customer may enter information about health or injury, disciplinary matters or work authorization. The Service is not designed for medical records or government identification numbers, and the Customer agrees to follow the Acceptable Use Policy about what not to enter.</p>
  </> },
  { title: "The Customer&rsquo;s instructions", body: <>
    <p>The Provider processes Customer Data only on the Customer&rsquo;s documented instructions. These Terms, this DPA, and the Customer&rsquo;s use of the Service and its settings are the Customer&rsquo;s complete instructions. They include the Customer&rsquo;s choices about which modules to turn on, which roles and permissions to grant, which notification channels and integrations to connect, and which automatic rules to apply. If the Provider believes an instruction breaks the law, it will tell the Customer and may stop carrying it out until the matter is resolved.</p>
    <p>The Provider will not sell Customer Data, will not share it for advertising, will not combine it with information from other sources to profile individuals, and will not use it to train artificial intelligence models.</p>
  </> },
  { title: "Roles of the parties", body: <>
    <p>As between the Customer and the Provider, the Customer is the controller, or business, and the Provider is the processor, or service provider. Where the Customer is itself a processor for another party, the Provider is a subprocessor and the Customer must make sure its instructions follow its own obligations. The Provider is a controller, or business, for its own account and security information as described in the Privacy Policy.</p>
  </> },
  { title: "Security measures in more detail", body: <>
    <p>Annex II lists the security measures. In practice they include the following.</p>
    <ul>
      <li><strong>Access control.</strong> Every request is checked on the server against the user&rsquo;s role and permissions. Queries are limited to the user&rsquo;s Workspace. Confidential notes are removed on the server before a page is built for people who may not see them. Restricted documents are limited to Owners and Admins.</li>
      <li><strong>Authentication.</strong> Passwords are stored as one-way hashes. Sessions use signed, HTTP-only cookies and can be ended by the user. Repeated failed sign-ins lock an account for a period, and a user is told by email when a new device signs in.</li>
      <li><strong>Abuse controls.</strong> Sign-in, password reset, magic links, forms and search are rate limited, and the browser receives security headers that restrict framing, content sniffing and scripts from other sources.</li>
      <li><strong>Integrity.</strong> Cases, timelines and audit entries are append-only. Audit entries are chained and signed with a secret key held outside the database, so that tampering can be detected. Owners and Admins can verify the chain and export the log.</li>
      <li><strong>Secrets.</strong> Credentials the Customer connects, such as messaging or human resources system keys, are encrypted before storage and are not shown again. API keys are stored only as hashes. Webhook requests are signed.</li>
      <li><strong>Network and hosting.</strong> The Service is served over HTTPS. It runs on managed hosting and a managed database provider, which apply their own physical and infrastructure protections.</li>
      <li><strong>Staff access.</strong> Provider staff have no standing access to Customer Workspaces. Support access is read-only, time-limited, announced to the Owner, and recorded in both the Workspace audit log and the Provider&rsquo;s own tamper-evident staff log. Staff roles are limited to what each person needs.</li>
      <li><strong>Development and change.</strong> Secrets are kept out of source code and releases are tracked in a changelog.</li>
      <li><strong>Resilience.</strong> The Provider keeps technical backups to recover the Service. They are not a substitute for the Customer&rsquo;s own exports.</li>
    </ul>
    <p>The Provider may update these measures as technology and threats change, as long as it does not materially reduce the overall level of protection.</p>
  </> },
  { title: "Staff confidentiality and training", body: <>
    <p>The Provider makes sure that people who can access Customer Data are bound by confidentiality and have access only as far as their role requires. The Provider limits staff accounts, requires verified email for staff console access, and logs staff actions. The Provider gives its staff guidance on handling personal information, on support access, and on recognizing and reporting incidents.</p>
  </> },
  { title: "Subprocessors in more detail", body: <>
    <p>The Customer gives general authorization for the subprocessors in Annex III. The Provider enters into written terms with each subprocessor that require protection of personal information consistent with this DPA, and remains responsible for its subprocessors&rsquo; performance of those terms.</p>
    <p>When the Provider plans to add or replace a subprocessor, it will update Annex III and give the Customer notice through the Service or by email where practical. The Customer may object on reasonable data protection grounds within the time stated in the main Subprocessors section. If the parties cannot resolve the objection, the Customer may stop using the part of the Service that depends on the new subprocessor, and may close its Workspace and export its data.</p>
    <p>Services that a Customer chooses to connect itself, such as a messaging provider, a human resources system, a chat tool or a file service, are not the Provider&rsquo;s subprocessors. They are the Customer&rsquo;s own service providers. The Provider sends information to them only because the Customer configured that connection, using the Customer&rsquo;s own credentials.</p>
  </> },
  { title: "Assisting with requests from individuals", body: <>
    <p>If an individual asks the Provider for access to, correction or deletion of their information in Customer Data, the Provider will refer the person to the Customer, unless the law requires otherwise, and will tell the Customer about the request where it is allowed to. The Provider will give the Customer reasonable help to respond, taking into account the nature of the processing. The Service lets the Customer search, view, export and, where the Service allows, delete or correct many records by itself. Where a record is append-only by design, such as a case or audit entry, the Customer may add a correcting note and may contact the Provider if a legal requirement means a record must be removed.</p>
  </> },
  { title: "Security incidents in more detail", body: <>
    <p>If the Provider becomes aware of a breach of security that leads to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to Customer Data (a &ldquo;Security Incident&rdquo;), it will notify the affected Customer without undue delay. The notice will say what the Provider knows about what happened, the kinds of information and approximate number of people affected, the likely consequences, and what the Provider is doing and what it suggests the Customer do. The Provider will update the Customer as it learns more, will take reasonable steps to contain and fix the incident, and will keep records of it. The Provider&rsquo;s notice of an incident is not an admission of fault. The Customer is responsible for any notices to individuals or authorities that the law requires it to give, and the Provider will give reasonable help with them.</p>
  </> },
  { title: "Return and deletion in more detail", body: <>
    <p>While the Workspace is open, the Customer can export its data using the tools in the Service. When the Customer closes the Workspace, or the Terms end, the Provider deletes or de-identifies Customer Data from the live database promptly and from backups on the provider&rsquo;s regular cycle, which the Provider expects to complete within 35 days. The Provider may keep information longer only where the law requires, in which case it protects the information and does not use it for other purposes. If a legal hold is in place on a Workspace, deletion is paused until the hold is lifted. The Provider will confirm deletion in writing if the Customer asks.</p>
  </> },
  { title: "Audits and information", body: <>
    <p>The Provider will give the Customer information reasonably needed to show that it follows this DPA, such as its Security page, its security summary, its changelog of security-relevant changes and answers to reasonable written questions. The Customer can also verify its own audit log from the Audit page. If the Customer needs more, for example because a regulator requires it, the parties will agree in good faith on a reasonable scope, time and confidentiality terms for an audit, which must not disrupt the Service or expose other customers&rsquo; data. Each party bears its own costs unless the audit finds that the Provider materially broke this DPA.</p>
  </> },
  { title: "Customer responsibilities in more detail", body: <>
    <p>The Customer is responsible for the following:</p>
    <ul>
      <li>Having a lawful basis, and giving any notices or getting any consents the law requires, for the information it enters and the ways it uses it, including any monitoring of employees.</li>
      <li>Entering only the information it needs and not entering information the Acceptable Use Policy forbids.</li>
      <li>Setting roles and permissions sensibly, reviewing them, and removing access promptly when people leave.</li>
      <li>Keeping its credentials, API keys, exports and connected-service accounts secure.</li>
      <li>Choosing and managing the integrations it connects, and making sure they have suitable protections.</li>
      <li>Responding to requests from its employees and others about the records it controls.</li>
      <li>Telling the Provider promptly if it believes a Security Incident has affected its account.</li>
    </ul>
  </> },
  { title: "International transfers in more detail", body: <>
    <p>The Provider and its subprocessors operate mainly in the United States, and Customer Data is processed there. If the law of a Customer&rsquo;s country requires a transfer mechanism for sending personal information to the United States, the parties will rely on a mechanism that the law recognizes, such as standard contractual clauses, and will add the clauses by written agreement on request. Until then, the Customer is responsible for deciding whether the Service is suitable for information that is subject to transfer restrictions.</p>
  </> },
  { title: "Liability and order of precedence", body: <>
    <p>Each party&rsquo;s liability under this DPA is subject to the limits in the Terms of Service, to the extent the law allows. If this DPA conflicts with the Terms or the Privacy Policy on how the Provider processes Customer Data for the Customer, this DPA controls. Otherwise the Terms control. A signed standard contract that the parties both agree overrides this DPA applies only to the extent it states.</p>
  </> },
  { title: "How to contact us about this DPA", body: <>
    <p>For questions about this DPA, to ask for a signed copy, to request deletion confirmation, to report a security concern or to object to a subprocessor change, use the <Link href="/contact">contact form</Link> and choose the topic that fits best. Include the Workspace name and the person who is authorized to act for the Customer.</p>
  </> },
];
