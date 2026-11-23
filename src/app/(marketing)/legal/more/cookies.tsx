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

export const cookiesMore: Section[] = [
  { title: "Why this policy exists", body: <>
    <p>Websites and apps can store small pieces of information on your device and can read information your browser sends. Some laws and good practice ask us to tell you what we store and why. This policy explains that in plain language. It supplements the <Link href="/legal/privacy">Privacy Policy</Link>.</p>
    <p>The short version is that we use only what is needed to run the Service and we do not use advertising or cross-site tracking.</p>
  </> },
  { title: "Types of technology we use", body: <>
    <ul>
      <li><strong>Cookies</strong> are small text files that your browser keeps and sends back to us on later requests. We use them mainly to keep you signed in.</li>
      <li><strong>Local storage</strong> is a place in your browser where a site can keep small pieces of data on your device. It is not sent to us on each request. We use it for preferences and to hold unsent offline work.</li>
      <li><strong>Service workers and caches</strong> let an installed or visited site store its own files on your device so it can load faster and show an offline page. Ours stores site files only and does not store pages that contain your records.</li>
      <li><strong>Server logs</strong> are records that our hosting systems keep when your browser asks for a page. They include things like IP address, browser type, the page requested and the time.</li>
    </ul>
  </> },
  { title: "What we store on your device", body: <>
    <T head={["Name or item", "Type", "Purpose", "How long"]} rows={[
      ["Session cookie", "Strictly necessary cookie", "Keeps you signed in. Signed, HTTP-only, and sent only over HTTPS in production.", "Up to 14 days, or until you sign out."],
      ["Active workspace cookie", "Strictly necessary cookie", "Remembers which workspace you were using.", "Up to 90 days."],
      ["Support access cookie", "Strictly necessary cookie", "Used only by our staff during a time-limited support access session.", "For the access period, then it ends."],
      ["Two-factor step cookie", "Strictly necessary cookie", "Set only between entering your password and entering your two-factor code. It is not a sign-in and is rejected as one.", "5 minutes."],
      ["Provider sign-in cookie", "Strictly necessary cookie", "Set only while you sign in with Google, GitHub or your company's single sign-on. Holds a one-time value that protects the sign-in against forgery.", "10 minutes."],
      ["Theme preference", "Local storage (functional)", "Remembers light, dark or system theme.", "Until you clear it."],
      ["Cookie notice choice", "Local storage (functional)", "Remembers that you dismissed the cookie notice so we do not show it again.", "Until you clear it."],
      ["Offline checklist queue", "Local storage (functional)", "Holds a checklist you completed without a connection until it can be sent. Removed after it sends.", "Until sent or you clear it."],
      ["Site files cache", "Service worker cache", "Stores scripts and styles so the app loads faster and an offline page can appear.", "Until the site updates the cache or you clear it."],
    ]} />
    <p>We do not set cookies for advertising, and we do not use third-party analytics or social media tracking cookies on the Site or in the application.</p>
  </> },
  { title: "How we count visits without cookies", body: <>
    <p>To understand which pages are used, the Site sends a small message when a page is viewed. We add one to a total for that page and that day. We do not store your IP address, a device identifier or anything that identifies you with that count, and we do not set a cookie for it. Because it contains no personal information and does not follow you around, we treat it as ordinary operation of the Site. It cannot tell us who you are, and it cannot tell whether two page views came from the same person.</p>
  </> },
  { title: "Strictly necessary and functional technologies", body: <>
    <p>The first group, strictly necessary, is what the Service needs in order to work, such as signing you in and keeping the active workspace. You cannot switch these off in the Service. If you block them in your browser, you will not be able to sign in. The second group, functional, remembers choices you made. You can clear these in your browser, and the Service will still work, though it may ask you again.</p>
  </> },
  { title: "Your choices", body: <>
    <ul>
      <li><strong>Browser settings.</strong> Most browsers let you see, block and delete cookies and local storage for a site. Look under privacy or site settings. Blocking the necessary cookies will stop sign-in from working.</li>
      <li><strong>Sign out.</strong> Signing out removes your session cookie. In Account settings you can also end sessions on other devices.</li>
      <li><strong>Installed app.</strong> If you installed the app to your device, you can remove it the way you remove any app, and you can clear site data in your browser.</li>
      <li><strong>Global Privacy Control and Do Not Track.</strong> We do not track you across sites, so these signals do not change what we do. We treat Global Privacy Control as an opt-out request where it applies.</li>
    </ul>
  </> },
  { title: "Shared and public devices", body: <>
    <p>If you use a shared or public computer, sign out when you finish, do not tell the browser to remember your password, and clear any unsent offline items. A calendar link or sign-in link that you open on a shared device may be saved in that device&rsquo;s history.</p>
  </> },
  { title: "Third-party services", body: <>
    <p>Our hosting provider and our email provider process requests and messages for us, as described in the Privacy Policy. They may create their own technical records, such as server logs, in doing that. Links on the Site to other websites are governed by those sites&rsquo; own policies. A Customer that connects another service to its Workspace, such as a chat tool or file service, is responsible for that service&rsquo;s own cookies and policies.</p>
  </> },
  { title: "Changes to this policy", body: <>
    <p>If we change what we store or why, we will update this policy and its date. If we ever add a technology that needs your permission, such as an analytics tool that uses cookies, we will ask for your choice first and explain it here.</p>
  </> },
  { title: "Common questions", body: <>
    <p><strong>Do you use Google Analytics or similar?</strong> No.</p>
    <p><strong>Do you track me across other sites?</strong> No.</p>
    <p><strong>Why is there a cookie notice if you only use necessary cookies?</strong> To be open about what we store. It is a notice, not a request for permission.</p>
    <p><strong>Will blocking cookies break the Site?</strong> The public pages will work. Signing in will not.</p>
    <p><strong>How do I remove everything?</strong> Sign out and clear site data for onboardops.org in your browser settings.</p>
  </> },
];
