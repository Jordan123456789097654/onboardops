import Link from "next/link";
import type { Section } from "../content";

export const retentionMore: Section[] = [
  { title: "How to read this policy", body: <>
    <p>Three groups of people are affected by retention. <strong>Customers</strong> decide what to keep in their Workspace. <strong>Employees and other individuals</strong> are the people the records are about. <strong>OnboardOps</strong> keeps the systems running and holds some operational and account data of its own. This policy says what each does and what happens at the end.</p>
    <p>The first parts of this policy give the retention schedule and the rules for closing a Workspace and deleting an account. The sections below explain, in more detail, how deletion works in practice, what cannot be deleted and why, and where copies can remain.</p>
  </> },
  { title: "Who decides how long to keep records", body: <>
    <p>While a Workspace is open, the Customer decides what to keep and for how long, within the limits of the Service. The Service does not automatically delete a Customer&rsquo;s records after a fixed time, except for operational items that expire on their own, such as sessions, one-time sign-in links and short-lived technical counters. This means that a Customer that does nothing keeps its records. Customers should set their own retention practices based on the laws that apply to them.</p>
    <p>Different records often have different legal retention periods, such as payroll, time records, safety logs, training records, discipline and personnel files. Those periods vary by place and by type of record. The Service does not know which period applies to you, and it does not tell you when to delete. Ask a qualified adviser what your obligations are, and set a routine to review and archive records.</p>
  </> },
  { title: "Deleting items inside an open Workspace", body: <>
    <p>The Service lets a Customer remove some kinds of records and not others.</p>
    <ul>
      <li><strong>Can usually be removed by a permitted user:</strong> uploaded documents and document links, credentials, checklist templates, shifts, handoff notes, equipment records, custom fields, locations, API keys and integration connections. Removing a document also removes the stored file.</li>
      <li><strong>Can be changed but not erased:</strong> employee records can be moved to an inactive or separated status, and details can be updated. Courses and policies can be unpublished or replaced with a new version.</li>
      <li><strong>Cannot be removed through the Service:</strong> infraction cases, their timelines, appeals and decisions, and audit entries. They are append-only so that the record stays reliable.</li>
    </ul>
    <p>Removing something does not remove it from copies that the Customer has already exported or from messages already sent to a connected service, such as a chat channel or email.</p>
  </> },
  { title: "Records that are append-only", body: <>
    <p>Cases, case timelines and audit entries are designed so that they cannot be edited or deleted through the Service. This helps employees and employers rely on them. It also means a mistake cannot be erased from the Service. To fix a mistake, add a correcting note, record an appeal outcome, or note that a record was entered in error. Strike points from a case can be restored when an appeal succeeds, and points can expire under a decay rule the Customer sets, but the case itself remains.</p>
    <p>If a law or a court requires that a specific record be removed, the Customer can contact us through the <Link href="/contact">contact form</Link>. We will verify the request and the authority, and we will consider removing or masking the record in a way that follows the law and keeps the rest of the audit chain verifiable where possible. We may not be able to do this where the law requires us to preserve the record.</p>
  </> },
  { title: "Legal holds", body: <>
    <p>A legal hold freezes deletion so that evidence is preserved. The Service lets our staff place a hold on a Workspace, at the Customer&rsquo;s request or when the law requires it. While a hold is in place, the Customer cannot delete documents, credentials, checklists, shifts or handoff notes, and cannot close the Workspace. The hold stays until it is lifted by us after the Customer tells us the requirement has ended, or after we learn from the proper authority that it has ended. The hold pauses the deletion timelines in this policy for the Workspace. We keep a record of who placed and lifted a hold and why.</p>
  </> },
  { title: "Closing a Workspace step by step", body: <>
    <ol>
      <li><strong>Export.</strong> The Owner downloads an export and any reports needed. Exports are the Customer&rsquo;s responsibility to store securely.</li>
      <li><strong>Check for holds.</strong> If a legal hold is in place, closing is not allowed until it is lifted.</li>
      <li><strong>Confirm.</strong> The Owner types the Workspace name and enters their password to confirm. Only an Owner can do this.</li>
      <li><strong>Deletion from the live service.</strong> The Workspace and everything in it are deleted from the live database, including employee records, cases, notes, reviews, documents, policies, requests, checklists, schedules, time records, API keys, integration credentials and the Workspace audit log.</li>
      <li><strong>Accounts.</strong> People who belong to no other Workspace have their login removed. People who belong to another Workspace keep their account for that one.</li>
      <li><strong>Backups.</strong> Copies in backups are overwritten on the hosting provider&rsquo;s regular cycle, which we expect to finish within 35 days.</li>
      <li><strong>Confirmation.</strong> On request, we confirm in writing that deletion was carried out.</li>
    </ol>
    <p>Closing cannot be undone. After the live deletion, we cannot restore the Workspace, and during the backup period we restore data only where the law requires and under strict limits.</p>
  </> },
  { title: "Deleting an account", body: <>
    <p>A person can ask to delete their own account from Account settings or through a privacy request. We verify the request, usually by matching the account email. We then delete the login, extra email addresses, profile picture, sign-in tokens, signed-in session records, support messages and related email log entries. If the person is the only Owner of a Workspace, they must transfer ownership or close the Workspace first, so that the people who use it are not left without access.</p>
    <p>Employee records that an employer created about the person belong to the employer. They are unlinked from the deleted account but not deleted, because the employer may need them. The person should ask the employer about those records.</p>
  </> },
  { title: "When an employee leaves a company", body: <>
    <p>Ending an employee&rsquo;s status in a Workspace does not delete their record. The Customer may need to keep it for legal or business reasons. Separated employees lose access to the Workspace, and their record stays with the Customer until the Customer deletes what the Service lets it delete, or closes the Workspace. A former employee who wants to see or correct records should ask the former employer first.</p>
  </> },
  { title: "Operational data that OnboardOps keeps", body: <>
    <p>Apart from Customer Data, we keep some information about the running of the Service. It is limited and used for security, reliability and support.</p>
    <ul>
      <li><strong>Account records</strong> for as long as the account is open, and then removed as described above.</li>
      <li><strong>Security and abuse records,</strong> such as sign-in events, lockouts and rate-limit counters. Most are short-lived and removed automatically.</li>
      <li><strong>Email delivery records,</strong> kept as long as needed to troubleshoot delivery and abuse, and removed with the account or Workspace where described.</li>
      <li><strong>Support messages,</strong> kept while we resolve the matter and for a reasonable time afterward, then removed on request or with the account.</li>
      <li><strong>Staff activity records,</strong> a tamper-evident log of actions that our staff take in the staff console, kept so that staff access can be reviewed.</li>
      <li><strong>Roadmap votes and feedback,</strong> kept while the item is relevant and removed with the account.</li>
      <li><strong>Page-view counts,</strong> aggregate numbers with no personal identifiers.</li>
    </ul>
  </> },
  { title: "Copies that we do not control", body: <>
    <p>We cannot delete information that has left the Service. Examples include files a user downloaded, exports, printouts and PDFs, emails already delivered, messages already sent to a chat channel or JSON webhook, texts already sent through a Customer&rsquo;s own messaging account, files that a Customer linked from another service, information a Customer synced to or from another system, and screenshots. The Customer is responsible for deleting those copies and for asking the connected service to do the same.</p>
    <p>A calendar feed link stops working when the person replaces or turns it off, when the employee record becomes inactive, or when the Workspace is closed. Calendar apps that already copied events may keep them until they refresh.</p>
  </> },
  { title: "Integration credentials and API keys", body: <>
    <p>When a Customer removes an integration, such as a messaging provider or a human resources system connection, the saved credentials are deleted from the Workspace. API keys can be revoked at any time and stop working at once. When a Workspace is closed, all of its credentials and keys are deleted. We recommend that the Customer also revoke or rotate the credentials in the other service.</p>
  </> },
  { title: "Backups and restores", body: <>
    <p>We keep technical backups so that we can recover from a serious failure. A backup is a copy of a point in time. Deleted data can remain in backups until they are overwritten, and we expect that to take no more than about 35 days. We do not restore a single item for a Customer from a backup as a routine service. We do not use backups for any other purpose, and we do not bring deleted data back into the live service except to recover from a failure or where the law requires.</p>
  </> },
  { title: "Examples", body: <>
    <p><strong>An owner closes the Workspace.</strong> The owner exports the records, confirms with the Workspace name and password, and the live data is deleted. Copies in backups are overwritten over the following weeks.</p>
    <p><strong>An employee asks to delete their account.</strong> We verify the request and remove the login and related account records. Their employer keeps its employee file, unlinked from the deleted login.</p>
    <p><strong>A case was entered by mistake.</strong> The manager adds a note that explains the mistake and, if the employee appealed, records the outcome. The case stays, and any points it added are restored.</p>
    <p><strong>A lawsuit begins.</strong> The Customer asks us to place a legal hold. Deletion of covered records is frozen until the hold is lifted.</p>
  </> },
  { title: "Questions about retention", body: <>
    <p><strong>Can you delete one record for me?</strong> You can remove the kinds of records the Service lets you remove. For others, contact us and tell us the legal reason.</p>
    <p><strong>How soon is my data gone after I close the Workspace?</strong> From the live service, promptly. From backups, we expect within 35 days.</p>
    <p><strong>Do you keep anything after deletion?</strong> Only what the exceptions above allow, such as a minimal record that a request was handled, or what the law requires.</p>
    <p><strong>Can an employer delete records about an employee to avoid a claim?</strong> Employers have their own legal duties to preserve records, and a legal hold freezes deletion. The Service cannot give legal advice. Ask a lawyer.</p>
  </> },
];
