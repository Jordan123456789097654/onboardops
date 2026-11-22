import Link from "next/link";
import type { Section } from "../content";

export const employeeMore: Section[] = [
  { title: "Why you are reading this", body: <>
    <p>Your employer uses OnboardOps to keep workplace records and to run training, checklists, schedules and other processes. This notice explains, in plain words, what the software does with information about you and what choices you have. It is written for employees, not lawyers. It does not replace any notice your employer gives you, and it does not change your rights under your employment arrangements or the law.</p>
    <p>If you read only one thing: your employer decides what to record about you. OnboardOps stores it, protects it, and shows it to the people your employer allows. You can see most of what is recorded about you, and you can ask questions.</p>
  </> },
  { title: "Your account and your sign-in", body: <>
    <p>To use the software you have an account that is tied to your name and email address. You can sign in with a password or with a link that is emailed to you. In Account settings you can change your name, nickname and picture, add or remove email addresses, change your password, see your signed-in devices, and end sessions you do not recognize. If someone signs in from a device we have not seen for your account, we email you so you can check it was you.</p>
    <p>If you work for more than one employer that uses OnboardOps, your account can be used for both. Each employer sees only what belongs to its own Workspace, and neither can see the other&rsquo;s records about you.</p>
  </> },
  { title: "What the software records about you", body: <>
    <p>Depending on what your employer has turned on, the software may record the following about you. Your employer can tell you which of these it actually uses.</p>
    <ul>
      <li><strong>Your profile:</strong> name, staff ID, work email, phone number, emergency contact, department, job role, location, hire date and employment status.</li>
      <li><strong>Training:</strong> courses assigned, progress, quiz answers and scores, how many tries you took, certificates and their expiry dates.</li>
      <li><strong>Policies:</strong> which policies applied to you, which version you signed and when.</li>
      <li><strong>Checklists and handoff notes:</strong> checklists you completed, notes and photos you added, and who verified them.</li>
      <li><strong>Schedule and time:</strong> shifts you were assigned, swap requests, and, if your employer uses the time clock, when you clocked in and out.</li>
      <li><strong>Time off and leave:</strong> requests, dates, the reason you gave, the decision, and your yearly allowance if your employer tracks one.</li>
      <li><strong>Incident reports:</strong> reports you filed, and reports that name you, with details your employer enters.</li>
      <li><strong>Conduct records:</strong> warnings, strike points, suspensions, your written response, any appeal and its outcome, and the timeline of events.</li>
      <li><strong>Managers&rsquo; notes:</strong> informal coaching notes and confidential notes written by managers.</li>
      <li><strong>Reviews and one-to-ones:</strong> ratings, comments and goals.</li>
      <li><strong>Credentials and documents:</strong> licenses, certifications and files or links your employer attaches.</li>
      <li><strong>Equipment:</strong> items signed out to you.</li>
      <li><strong>Activity records:</strong> an audit log that records who did what to a record and when.</li>
    </ul>
  </> },
  { title: "Who at your workplace can see it", body: <>
    <p>Your employer sets roles. In general you see your own record and items shared with you. Supervisors, managers, administrators and owners can see more, depending on their role and any special permissions your employer gave them. Some items are limited to a smaller group. Restricted documents, such as work-authorization papers, are limited to owners and administrators. Confidential notes are hidden from you and from supervisors.</p>
    <p>If you are not sure who can see something about you, ask your employer. They can look at the role settings in their Workspace.</p>
  </> },
  { title: "What you can see yourself", body: <>
    <p>In your portal you can see your courses and certificates, policies, checklists, requests, notices that need your signature, incident reports you filed, documents your employer chose to share, and reviews shared with you. You can add a written response to a conduct record about you, file an appeal where your employer allows it, ask to update your phone number and emergency contact, and request time off. Some things are not shown to you by the software, such as confidential manager notes. Your employer may have separate legal duties to show you or correct records, so ask them directly if you want to see or fix something.</p>
  </> },
  { title: "Your written response and appeals", body: <>
    <p>If a warning or other conduct record is added about you, you can add your own written response so that your side is in the record. Where your employer has turned on appeals, you can ask for the record to be reviewed. The software requires that the person who decides your appeal is not the person who issued the record. If an appeal succeeds and the record had strike points, the software removes them. These are tools your employer gave you. How fairly they are used is up to your employer, and you should ask your employer about its process.</p>
  </> },
  { title: "Reporting a concern, including anonymously", body: <>
    <p>You can file an incident report about a safety problem, near miss, injury or conduct concern, and you can attach photos. You can choose to report anonymously. If you do, the software does not save your name or employee record with the report, so it will not appear in your own list of reports and managers cannot reply to you through the software. Your employer should not try to find out who you are. Anonymous reports can be harder to investigate because nobody can ask you questions. If you want a reply, do not choose anonymous.</p>
    <p>Employers have legal duties not to retaliate against employees who report in good faith. If you believe you were treated badly for reporting, tell your employer, and consider getting advice from a lawyer or from the government agency that handles your issue.</p>
  </> },
  { title: "Signing something", body: <>
    <p>When the software asks you to type your name to sign a notice or policy, it records your typed name, the version and the time. For a conduct record, signing confirms that you received it. It is not an admission that it is true, and it does not mean you agree. The signing screen says so. For a policy, signing means that you read it, as your employer requires. If you disagree with something you were asked to sign, you can add a response and speak to your manager before or after you sign.</p>
  </> },
  { title: "Optional tools you control", body: <>
    <ul>
      <li><strong>Email preferences.</strong> You can switch off several kinds of optional emails. Sign-in and security emails are always sent.</li>
      <li><strong>Quiet hours.</strong> You can record the hours you prefer not to be contacted.</li>
      <li><strong>Calendar link.</strong> You can create a private link that lists your shifts and approved time off, so you can see them in your own calendar app. Anyone with the link can see those items, so do not share it. You can replace it or turn it off at any time, and the old link then stops working.</li>
      <li><strong>Text messages.</strong> If your employer has connected a messaging account, you can choose to get texts about new shifts, swap answers and request decisions. They are off until you turn them on. You can turn them off in the portal or reply STOP. Message and data rates from your carrier may apply.</li>
      <li><strong>Offline checklists.</strong> If you use the installed app, a checklist you finish without a connection is kept on your device until it can be sent. Use a device you control.</li>
    </ul>
  </> },
  { title: "What OnboardOps does with your information", body: <>
    <p>OnboardOps stores your information for your employer, keeps it secure, and uses it only to run the service for them, to protect the service, to help with support, and to meet legal duties. We do not sell your information. We do not use it for advertising. We do not use it to train artificial intelligence. Our staff have no standing access to your employer&rsquo;s records. If our staff need to look, it is through time-limited, read-only access that the owner is told about, and that appears in your employer&rsquo;s audit log. See the <Link href="/legal/privacy">Privacy Policy</Link> for how we handle account information and the <Link href="/legal/data-processing">Data Processing Addendum</Link> for how we handle your employer&rsquo;s records.</p>
  </> },
  { title: "How long records are kept", body: <>
    <p>Your employer decides how long to keep records about you while its Workspace is open, and it is responsible for following any laws about how long certain records must be kept or deleted. If your employer closes its Workspace, we delete its data, and the records about you are deleted with it. If you leave the company, your employer may keep the records it is allowed or required to keep. Our <Link href="/legal/retention">Data Retention and Deletion Policy</Link> gives the details.</p>
  </> },
  { title: "Your rights and how to use them", body: <>
    <p>Your rights depend on where you live and the law that applies to your employer. In many places you can ask what is kept about you, ask to correct mistakes, and in some cases ask for deletion. Because your employer controls the records, make these requests to your employer first. If you ask us instead, we will help you reach the right person, and we cannot give you your employer&rsquo;s records without a lawful basis or your employer&rsquo;s direction. For your own account, you can use the tools in Account settings or send a privacy request through the contact form.</p>
    <p>You will not be treated worse by OnboardOps because you asked about your information. We cannot speak for your employer, but employers also have legal duties not to retaliate in certain situations.</p>
  </> },
  { title: "If you are under 18", body: <>
    <p>If you are under 18, you may use the service with permission from a parent or guardian, as the Terms of Service say. Your employer has extra legal duties for young workers, such as limits on hours and on what can be asked of you. If you have a question, ask a parent, guardian or trusted adult, as well as your employer.</p>
  </> },
  { title: "If something looks wrong", body: <>
    <p>If you see a record about you that looks wrong, ask your manager or HR contact to correct it or to add your response. If you think someone misused your information, or your account was used by somebody else, change your password, end your other sessions in Account settings, and tell your employer. You can also tell us through the <Link href="/contact">contact form</Link>. We will not be able to tell you details of your employer&rsquo;s records, but we can look into the account and security side.</p>
  </> },
  { title: "Questions you might have", body: <>
    <p><strong>Who can read my written response to a warning?</strong> It is added to the record, so the people who can see that record can see your response.</p>
    <p><strong>Can OnboardOps see my employer&rsquo;s file on me?</strong> Not routinely. Only through limited, logged, time-limited access.</p>
    <p><strong>Does signing a warning mean I agree?</strong> No. It means you received it.</p>
    <p><strong>Can I use the software on my own phone?</strong> Yes, if your employer allows it. Sign out when you finish on any shared device.</p>
    <p><strong>Is my employer tracking my location?</strong> The software does not collect your location.</p>
    <p><strong>Who do I ask about a record?</strong> Your employer first.</p>
  </> },
];
