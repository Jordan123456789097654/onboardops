import Link from "next/link";
import type { Section } from "../content";

export const betaMore: Section[] = [
  { title: "What the beta is for", body: <>
    <p>OnboardOps is in an early stage. We offer the Service for free to a limited number of teams so that we can learn how real workplaces use it, find mistakes, and decide what to build next. In return, we ask for your patience and, if you are willing, your honest feedback. These Beta Program Terms add to the Terms of Service for as long as the Service is labeled beta.</p>
  </> },
  { title: "What can change during the beta", body: <>
    <p>Expect the Service to change often. During the beta we may do any of the following, sometimes without notice:</p>
    <ul>
      <li>Add, change, rename, move or remove features and pages.</li>
      <li>Change how features work, such as how points are calculated, how roles and permissions behave, or how notifications are sent.</li>
      <li>Change limits, such as the number of items, file sizes, how often something can be done or how long data is kept in certain places.</li>
      <li>Change the design, the layout and the names of things.</li>
      <li>Reset or repair data in a Workspace to fix a serious problem, where we believe it is necessary, and we will tell you if we do.</li>
      <li>Take the Service offline for maintenance, sometimes with little warning.</li>
    </ul>
    <p>We try to avoid changes that make your work harder, and the changelog on the website records notable changes. We do not promise that any feature will remain available or work the same way.</p>
  </> },
  { title: "Reliability and data protection during the beta", body: <>
    <p>Beta software has bugs. Please plan for that:</p>
    <ul>
      <li><strong>Export regularly.</strong> Use the export tools to keep your own copies of records you cannot afford to lose. Backups that we keep are for our own recovery and are not a guarantee that we can restore your data.</li>
      <li><strong>Check important results.</strong> If a calculation, an automatic effect, a reminder or a notification affects someone&rsquo;s job, pay or safety, check it yourself until you trust it. Do not rely on a reminder or alert as your only safeguard.</li>
      <li><strong>Keep your paper processes where the law requires them.</strong> Do not stop keeping records that the law requires you to keep in another form solely because you entered them here.</li>
      <li><strong>Use sensible test data when trying something new.</strong> If you want to experiment, try it with sample information first.</li>
    </ul>
  </> },
  { title: "Is the beta right for your team?", body: <>
    <p>The beta works best for small teams and for teams that want to help shape the product. It may not be right if you need guaranteed availability, a contractual service level, a formal security certification, single sign-on or two-factor authentication, or certain integrations. The Security page lists the gaps that we know about. If something you need is not there, tell us. It may influence what we build.</p>
  </> },
  { title: "Your feedback", body: <>
    <p>You can send feedback from inside the application or through the contact form. Feedback may be about bugs, confusing screens, missing features or ideas. Please do not include sensitive personal information about employees in feedback. If you need to show us a problem, describe it or use sample data.</p>
    <p>As the Terms of Service say, you let us use your feedback to improve the Service without paying you or giving credit. We may show a short, public description of an idea on the public roadmap, without naming you or your company, and you can vote on roadmap items when you are signed in. Being asked for feedback is not a promise that we will act on it.</p>
  </> },
  { title: "Support during the beta", body: <>
    <p>We provide help on a best-effort basis through the help center and the contact form. We cannot promise a response time. If you report a problem, we may ask for details such as the page, the time and what you expected to happen. We may ask for limited, time-limited access to your Workspace to investigate, which we will request, announce to the Owner and record as described in the Terms of Service.</p>
  </> },
  { title: "Privacy and security during the beta", body: <>
    <p>The Privacy Policy, the Data Processing Addendum and the Acceptable Use Policy apply during the beta in full. We protect Customer Data the same way during the beta as at any other time, and we will not use it for a purpose beyond running and improving the Service as those documents describe. Because we are early, we may not yet have every control that a larger company has. We list those gaps openly on the Security page, and you should consider them when deciding what to store.</p>
  </> },
  { title: "Fees and what happens when the beta ends", body: <>
    <p>The beta is free. When we introduce paid plans, we will tell you in advance, show you the price and what each plan includes, and ask you to agree before you are charged. We will not turn a free Workspace into a paid one without the Owner&rsquo;s agreement. If you decide not to move to a paid plan, we will give you reasonable notice and a chance to export your data before access ends, and we will not charge you for exporting. If we end the beta and shut the Service down, we will give notice and a chance to export first, as far as is practical.</p>
  </> },
  { title: "Ending your participation", body: <>
    <p>You can stop using the Service at any time, export your data and close your Workspace. We can end your participation or a feature at any time as these Terms describe, and we will try to give notice and a chance to export first unless the reason is serious, such as a threat to people or the Service. Sections that by their nature continue after the beta, including confidentiality, feedback, disclaimers and limits of liability, continue to apply.</p>
  </> },
  { title: "Confidentiality of unreleased features", body: <>
    <p>If we show you something that is not public and ask you to keep it confidential, please do. Information is not confidential if it is already public, if you already knew it, if you receive it from someone who is free to share it, or if you develop it on your own without using ours. If the law requires you to disclose it, tell us first where you can.</p>
  </> },
  { title: "Who this beta is not for", body: <>
    <p>Do not use the beta to store information that the Acceptable Use Policy forbids, or to carry out an activity where a failure of the Service could cause serious harm, such as the sole record of a safety-critical process, without safeguards of your own. Do not use the beta if you are under the minimum age in the Terms of Service.</p>
  </> },
  { title: "Security during the beta", body: <>
    <p>We apply the safeguards on our Security page during the beta, but <strong>we cannot guarantee that your information will be 100% secure</strong>, and because the Service is early it may not yet have every protection that larger or older services have. Please keep your own backups, enter only what you need, and read the list of gaps on the Security page before you decide what to store.</p>
  </> },
  { title: "Questions about the beta", body: <>
    <p><strong>Is my data safe?</strong> We protect it with the controls on the Security page. Because this is a beta, also keep your own exports.</p>
    <p><strong>Will I be charged without warning?</strong> No. We will tell you and ask first.</p>
    <p><strong>Can I invite my whole company?</strong> Yes, within the limits of the Service. If you invite many people, tell us if you notice problems.</p>
    <p><strong>What if something breaks?</strong> Tell us through the <Link href="/contact">contact form</Link> or the feedback button in the application.</p>
    <p><strong>Will the features I use stay?</strong> We cannot promise that. The roadmap and the changelog show what is changing.</p>
  </> },
];
