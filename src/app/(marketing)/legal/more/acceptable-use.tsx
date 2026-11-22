import Link from "next/link";
import type { Section } from "../content";

export const aupMore: Section[] = [
  { title: "Who this policy applies to", body: <>
    <p>This policy applies to everyone who uses the Service or the Site: Customers and their Owners, Admins, Managers, Supervisors and Employees, people who contact us, and anyone who uses an API key or other automated access. A Customer is responsible for the use of its Workspace by its Users, including people it invites and anyone who uses a credential that belongs to the Workspace.</p>
  </> },
  { title: "Prohibited uses in detail", body: <>
    <p>The earlier sections state the rules in general terms. This section gives more detail so that you can tell where the lines are. These examples do not list everything that is forbidden.</p>
    <p><strong>Unlawful or harmful records.</strong> Do not use the Service to keep records or take actions that are unlawful where you operate, to discriminate against people because of a protected characteristic, to retaliate against someone for reporting a concern or using a legal right, to harass, threaten or humiliate a person, or to carry out surveillance that the law does not allow.</p>
    <p><strong>False or misleading information.</strong> Do not enter records you know to be false, back-date or change the story of events to mislead, create cases or incident reports about a person to harm them rather than to document real events, or impersonate another person or organization.</p>
    <p><strong>Misuse of other people&rsquo;s accounts.</strong> Do not sign in as someone else, share a password, use another person&rsquo;s sign-in link, or get around a role or permission. Do not ask an employee to sign a policy or case on someone else&rsquo;s behalf.</p>
    <p><strong>Interfering with the Service.</strong> Do not send malicious code, scan or probe the Service without our permission, try to get around rate limits, lockouts or access controls, overload the Service, use the API in a way that harms it, or interfere with other customers.</p>
    <p><strong>Abusing communication features.</strong> Do not use notifications, email, webhooks or text messages to send spam, to send messages that the recipient did not agree to receive, or to send content that is abusive or deceptive. Follow the laws for messaging where you send, including consent and opt-out rules.</p>
    <p><strong>Copying or competing.</strong> Do not copy the Service, reverse engineer it where the law allows us to forbid that, or use it to build a competing product. Do not resell access unless we agree in writing.</p>
  </> },
  { title: "Data you must not store", body: <>
    <p>The Service is meant for workplace records. Do not upload, enter or link the following unless we have agreed in writing that the Service is suitable for it:</p>
    <ul>
      <li>Social Security cards or full Social Security numbers, passport scans or other government identification numbers, except for a work-authorization document that your law requires you to keep, which must be stored as a restricted document.</li>
      <li>Bank account numbers, payment card numbers and similar financial credentials.</li>
      <li>Medical records, diagnoses, treatment notes and health insurance information. Basic injury details required to log a workplace incident are allowed. Keep them to the minimum.</li>
      <li>Biometric data such as fingerprints or face scans.</li>
      <li>Passwords or secrets for systems that are not part of the Service.</li>
      <li>Information about children under 13.</li>
      <li>Material that is illegal to possess, including sexual content involving minors, and anything that infringes another person&rsquo;s rights.</li>
    </ul>
    <p>If you store something by mistake, remove it. If you cannot, contact us so that we can help.</p>
  </> },
  { title: "Rules for managers and administrators", body: <>
    <p>People who hold roles with wider access carry added responsibility. If you are an Owner, Admin, Manager or Supervisor, you agree to the following in addition to the rules above.</p>
    <ul>
      <li>Use access only for a legitimate work reason. Do not look at records about a person out of curiosity or for a personal purpose.</li>
      <li>Keep confidential notes factual and professional. Assume that anything you write may one day be read by someone else, such as the employee, a regulator or a court.</li>
      <li>Apply rules consistently. Do not use strike points, suspensions or other automatic effects to punish someone unfairly or to treat people differently without a good reason.</li>
      <li>Give employees a fair chance to respond and to appeal where your policies provide for it. Do not decide an appeal about a case you issued.</li>
      <li>Do not try to find out who filed an anonymous report, and do not treat a good-faith report as misconduct.</li>
      <li>Give access to the minimum number of people who need it, review who holds powerful roles from time to time, and remove access promptly when someone leaves or changes jobs.</li>
      <li>Protect exports, printouts and files you download. Do not leave them on a shared computer or send them over an insecure channel.</li>
    </ul>
  </> },
  { title: "Employees and other individual users", body: <>
    <p>If you use the Service as an employee, please use your account only for your own work. Do not file reports you know to be false, do not use another person&rsquo;s name when signing, do not share a private calendar link or sign-in link with people who should not have it, and do not try to see records you are not allowed to see. You are free to file incident reports and appeals in good faith, and we ask Customers not to punish people for doing so.</p>
  </> },
  { title: "Customer responsibility for Users", body: <>
    <p>A Customer must make sure that its Users know and follow this policy, that people who leave are removed promptly, and that credentials, API keys and sign-in links are kept secure. If a User breaks this policy, the Customer is responsible for it, and we may act against the User, the Workspace or both.</p>
  </> },
  { title: "Reporting a problem", body: <>
    <p>If you see something that breaks this policy, or you think your account or a Workspace has been misused, tell us through the <Link href="/contact">contact form</Link> and choose the topic that fits best. Give enough detail for us to find the problem, such as the Workspace name, the date, and what you saw. Do not include sensitive personal details that we do not need. We will look into reports and may ask you for more information. We cannot always tell you what action we took, but we will do what we reasonably can.</p>
    <p>If someone is in immediate danger, contact local emergency services first. We are not an emergency service.</p>
  </> },
  { title: "How we investigate and enforce", body: <>
    <p>We do not routinely read the contents of Workspaces. We may look into a possible violation when we receive a report, when we see signs of abuse or a security risk, or when the law requires. We use the least intrusive way that works, for example looking at account activity or logs before looking at content, and we use time-limited and logged access when we need to see a Workspace.</p>
    <p>Depending on how serious the violation is and whether it is repeated or deliberate, we may take one or more of these steps:</p>
    <ul>
      <li>Ask you to remove or correct something.</li>
      <li>Remove or restrict content or a feature.</li>
      <li>Limit or revoke an API key or automated access.</li>
      <li>Suspend a User or lock a Workspace while the problem is resolved.</li>
      <li>End access and delete the account or Workspace as the Terms of Service allow.</li>
      <li>Report conduct to the authorities, or cooperate with them, where we believe the law is broken or someone is at risk.</li>
    </ul>
    <p>Where practical, we tell the Customer what we found and give a chance to fix it first. We may act without notice when it is needed to stop immediate harm, to protect people or the Service, or when the law requires.</p>
    <p>If you think we made a mistake, reply to our message or write to us through the contact form, explain why, and we will review it.</p>
  </> },
  { title: "Security research and good-faith testing", body: <>
    <p>We welcome responsible reports of security problems. If you want to test the Service, please follow these ground rules so that your testing stays safe and legal:</p>
    <ul>
      <li>Test only with accounts and Workspaces that you own or have permission to use. Do not access, change or delete other people&rsquo;s data.</li>
      <li>Stop and tell us if you reach real personal information, and do not copy, keep or share it.</li>
      <li>Do not run attacks that degrade the Service, such as denial of service, mass automated requests, spam or social engineering of our staff or users.</li>
      <li>Give us a reasonable chance to fix the problem before you disclose it publicly.</li>
      <li>Send your report through the contact form with enough detail to reproduce it. Do not send sensitive data in the report.</li>
    </ul>
    <p>If you follow these rules in good faith, we will not take legal action against you for your research and will work with you to understand and resolve the issue. This is not permission to break the law, and it does not bind other people, such as your employer or a third party.</p>
  </> },
  { title: "Examples", body: <>
    <p><strong>Acceptable:</strong> a manager records that an employee arrived 25 minutes late on a named date, cites the attendance policy and gives the employee a copy to respond to. An employee files an incident report about a spill in a hallway and attaches a photo. An Admin creates a read-only API key to sync a schedule to another tool, stores the key safely and revokes it when the project ends.</p>
    <p><strong>Not acceptable:</strong> a manager opens a case with exaggerated claims to push out an employee who complained. An administrator reads the personal records of a former partner who works at the company. A user uploads a scan of a passport to a general document folder. Someone posts an API key in a public code repository. A person tries thousands of passwords against another account.</p>
  </> },
  { title: "Changes to this policy", body: <>
    <p>We may update this policy as the Service and the law change. We will post the new version with a new date and, for material changes, give notice in the Service or by email at least 14 days before they take effect where practical.</p>
  </> },
];
