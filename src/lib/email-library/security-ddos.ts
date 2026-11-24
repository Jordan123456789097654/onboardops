import { tpl } from "./types";

const C = "Security & Incidents" as const;

/** Attacks on availability and abuse of the service: DDoS, bots, credential stuffing, rate limits and related notices. */
export const SECURITY_DDOS = [
  tpl(C, "ddos-active", "DDoS attack in progress", "Tell customers an attack is under way and what to expect", "shield",
    "We are defending OnboardOps against an attack ({{incident_id}})", "Some pages may be slow. Your data is not at risk.",
    ["Follow live status", "{{status_url}}"], `
Hi {{name}},

OnboardOps is the target of a distributed denial-of-service (DDoS) attack. Attackers are sending huge amounts of traffic to try to knock the service offline. We are defending against it now.

>! Started {{start_time}} on {{date}}. Reference {{incident_id}}.

## What a DDoS attack is
A DDoS attack tries to overwhelm a website with fake traffic so real people cannot get through. It is an attack on availability. It is not a break-in.

## Is your data at risk
>+ This kind of attack does not steal or change records. We have seen no sign of any access to your data.

## What you may notice
{{symptoms}}

## What we are doing
- Filtering hostile traffic at the edge, before it reaches the app.
- Adding capacity and tightening protection rules as the pattern changes.
- Watching for any attempt to use the noise as cover for something else.

## What you can do
1. Try again in a minute if a page does not load. Do not press submit repeatedly.
2. Anything you saved and saw a confirmation for was saved correctly.
3. Follow {{status_url}} for live updates. It is hosted separately, so it stays up.
4. If your team relies on OnboardOps during shifts, switch to your paper fallback for now.

We will update you again within {{next_update}}. We are sorry for the disruption.
`),

  tpl(C, "ddos-update", "DDoS update: still being mitigated", "Keep customers informed during a long attack", "clock",
    "Update on the attack against OnboardOps ({{incident_id}})", "Where things stand now.",
    ["See live status", "{{status_url}}"], `
Hi {{name}},

Here is an update on the attack we told you about (reference {{incident_id}}).

[details]
Status: {{status}}
Last updated: {{time}} on {{date}}
Service right now: {{affected}}

## What has changed
{{update}}

## What we are doing next
{{next_steps}}

## What this means for you
- Most requests are going through, though some people may still see slowness or errors.
- Your records are safe and have not been accessed.
- If something fails to save, you will see an error. Please repeat it once pages respond.

We will send the next update by {{next_update}}. Live status is always on {{status_url}}.
`),

  tpl(C, "ddos-resolved", "DDoS attack ended", "Confirm the attack has stopped and service is normal", "seal",
    "The attack has ended and OnboardOps is back to normal", "A short summary of what happened.",
    ["Read the summary", "{{status_url}}"], `
Hi {{name}},

The attack against OnboardOps (reference {{incident_id}}) has stopped, and the service is working normally again.

[details]
Started: {{start_time}} on {{date}}
Ended: {{end_time}}
Longest period of disruption: {{duration}}
Affected: {{affected}}

## Your data
>+ No customer records were accessed, changed or deleted. This was an attack on availability.

## What we did
- Blocked the hostile traffic and kept real people connected where we could.
- Kept the protections in place afterwards, in case the attack returns.
- Saved the evidence so we can review it carefully.

## What happens next
We will publish a short review of what we learned and what we are changing. If you want to talk it through, reply to this email.

Thank you for your patience, and for trusting us with your team's records.
`),

  tpl(C, "ddos-review", "DDoS post-incident review", "Explain what happened and what changes after an attack", "book",
    "Review of the attack on {{date}} ({{incident_id}})", "What we learned and what we are changing.",
    ["Read the review", "{{action_url}}"], `
Hi {{name}},

After the attack on {{date}}, we reviewed what happened. Here is a plain account.

[details]
Reference: {{incident_id}}
Peak size: {{attack_size}}
Disruption: {{duration}}
Affected: {{affected}}

## What happened
{{what_happened}}

## What worked
- {{good_one}}
- {{good_two}}

## What did not work well
- {{bad_one}}
- {{bad_two}}

## What we are changing
1. {{change_one}}
2. {{change_two}}
3. {{change_three}}

## What this means for you
>+ Your records were never accessed. The changes above are meant to keep the service reachable the next time someone tries.

If you would like more detail, reply and we will go through it honestly.
`),

  tpl(C, "ddos-extortion", "Extortion threat received", "Tell customers about a ransom demand and that we will not pay", "alert",
    "A threat against OnboardOps, and why you do not need to worry", "We received a demand. Here is where we stand.",
    ["Follow live status", "{{status_url}}"], `
Hi {{name}},

We want you to hear this from us first. On {{date}} we received a message demanding payment and threatening to attack OnboardOps if we did not pay.

>! We will not pay. Paying encourages further attacks and does not make them stop.

## What we know
{{what_happened}}

## What we are doing
- Reported it to the right authorities and to our providers.
- Strengthened our defenses against the kind of attack that was threatened.
- Preparing communications and fallback steps in case there is disruption.

## Does this affect your data
>+ The threat was about disrupting the service. It did not involve access to your records, and we have seen no sign of any.

## What you can do
Nothing special. If your team depends on OnboardOps for time-critical work, keep a simple paper fallback for checklists and shift notes, as good practice. Live status is on {{status_url}}.

If you receive a message that claims to be from the attackers, or from us, asking for money, do not respond. Forward it to us.
`),

  tpl(C, "rate-limits", "Temporary rate limits turned on", "Explain that protective limits may slow some actions", "clock",
    "We have turned on temporary protection limits", "You may see a message asking you to slow down.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

To protect OnboardOps while we deal with {{reason}}, we have turned on temporary limits on how fast some actions can be repeated.

[details]
Turned on: {{start_time}} on {{date}}
Expected to last: {{duration}}
Affects: {{affected}}

## What you might see
- A message asking you to wait a moment before trying again.
- Slower imports, exports or bulk changes.

## What you can do
1. Wait a few seconds, then try again.
2. Avoid large imports and exports until we lift the limits.
3. If you are blocked for ordinary use, tell us what you were doing and we will check.

>+ Normal day-to-day use, such as signing in, taking training and completing checklists, should not be affected.

We will email you when the limits are lifted.
`),

  tpl(C, "bot-blocking", "We are blocking automated traffic", "Explain extra checks caused by bot protection", "shield",
    "Extra checks while we block automated traffic", "You may be asked to confirm you are human.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

We are seeing large amounts of automated traffic, such as bots trying many passwords or copying pages. To stop it, we have turned on extra protection.

## What you may notice
- A quick check to confirm you are a person, mostly when signing in.
- A short delay on some pages.
- Very rarely, a block that should not have happened.

## Why we are doing it
Automated traffic wastes capacity and is often used to guess passwords. Blocking it keeps the service fast and your accounts safer.

## If you are blocked by mistake
- Try again from a different network, such as mobile data.
- Make sure your browser is up to date and not blocking scripts.
- Tell us your approximate time and the page. We can look at the logs and fix it.

## What you can do to help
Use a strong, unique password and turn on two-step sign-in. Those protect you whatever happens at the edge.
`),

  tpl(C, "blocked-by-mistake", "If you were blocked by mistake", "Help people on a VPN or shared network who were caught by protections", "unlock",
    "Having trouble reaching OnboardOps? Here is why", "Protection rules sometimes catch the wrong people.",
    ["Contact support", "{{support_url}}"], `
Hi {{name}},

Some people have been unable to reach OnboardOps since we strengthened our protection on {{date}}. If that is you, we are sorry. It is likely a side effect of how we are defending the service.

## Who is most likely to be affected
- People on a VPN or a shared workplace network that many others also use.
- People whose network address has been used by bots recently.
- Older browsers or browsers with strict privacy blocking.

## Things to try first
1. Turn off your VPN and try again.
2. Try mobile data instead of workplace Wi-Fi.
3. Update your browser, or try another one.
4. Wait ten minutes. Some blocks clear by themselves.

## If it still does not work
Send us the following from another device or network:
- The time you tried, with your time zone.
- The approximate network or location you were on.
- Any message or reference code the page showed.

>+ We can allow a trusted address, such as your workplace, once we confirm it is you.

We are tuning the rules to catch fewer genuine people. Thank you for your patience.
`),

  tpl(C, "credential-stuffing", "Credential-stuffing attempts: protect your account", "Warn customers about attacks that reuse leaked passwords", "key",
    "Attackers are trying leaked passwords on OnboardOps: please protect your account", "Two quick steps keep you safe.",
    ["Secure my account", "{{action_url}}"], `
Hi {{name}},

We have seen a wave of sign-in attempts using email addresses and passwords that came from breaches at other companies. This is called credential stuffing. Attackers hope people reuse the same password everywhere.

[details]
Seen: {{start_time}} to {{end_time}} on {{date}}
Reference: {{incident_id}}

## Has anyone got into accounts
{{what_happened}}

## What we did
- Blocked the sources and slowed repeated attempts.
- Locked any account where an attempt looked suspicious, and emailed its owner.
- Added extra checks on sign-in.

## What we ask you to do
1. Use a password you do not use anywhere else.
2. Turn on two-step sign-in. Even a leaked password cannot get past it.
3. Ask your team to do the same, especially Owners and Admins.
4. Check the audit log for sign-ins you do not recognize.

>! We will never email you asking for your password or sign-in codes.

If you want help moving your team to two-step sign-in, reply and we will walk you through it.
`),

  tpl(C, "brute-force-spike", "Spike in sign-in attempts", "Explain why some accounts were locked", "lock",
    "Why your OnboardOps account may have been locked", "A burst of sign-in attempts triggered our protection.",
    ["Reset my password", "{{action_url}}"], `
Hi {{name}},

On {{date}} there was a sharp rise in attempts to sign in to OnboardOps accounts. Our protection locked accounts that were receiving repeated wrong passwords. Yours may be one of them.

## What this means
- A lock is temporary and protects you from someone guessing your password.
- It was not caused by anything you did.
- Your records were not accessed.

## What to do
1. Wait until the lock ends, then sign in, or reset your password now to unlock it right away.
2. Use a strong, unique password.
3. Turn on two-step sign-in.

## If you did not try to sign in
That is expected. The attempts came from someone else. A lock means our system stopped them.

If you cannot get back in, contact us from the help center and we will check that it is you before helping.
`),

  tpl(C, "api-throttled", "Key or webhook throttled for abuse", "Tell a customer their integration was slowed", "key",
    "An integration in your workspace was slowed down", "Unusual volume triggered our protection.",
    ["Review your integrations", "{{action_url}}"], `
Hi {{name}},

An integration connected to {{workspace}} was sending far more requests than normal, so we slowed it to protect the service.

[details]
What was slowed: {{credential}}
Started: {{start_time}} on {{date}}
Reference: {{incident_id}}

## What this might mean
- A script or tool is stuck in a loop or retrying too quickly.
- The key or address has been copied by someone else.
- A new setup is sending more than it needs to.

## What to do
1. Check what is using the integration, and stop any loop.
2. If you are not sure, create a new key and remove the old one.
3. Make sure the key is stored only in a password manager or secrets vault.

>! If the traffic was not yours, treat the key as exposed and replace it right away.

Once things look normal, we lift the limit automatically. Tell us if you need it lifted sooner.
`),

  tpl(C, "abuse-report", "Abuse report about your workspace", "Notify an owner about a complaint and ask them to respond", "alert",
    "We received a report about activity in {{workspace}}", "Please read and reply by {{deadline}}.",
    ["Reply to this report", "{{support_url}}"], `
Hi {{name}},

We received a report about activity connected to your workspace "{{workspace}}". We want to hear your side before we take any action.

[details]
Reference: {{incident_id}}
Received: {{date}}
Type: {{request_type}}
Reply by: {{deadline}}

## What was reported
{{what_happened}}

## What we need from you
1. Tell us whether you know about this, and what happened.
2. Stop anything that breaks our Acceptable Use Policy.
3. Tell us what you have changed.

## What happens next
- If this is a mistake or is fixed, we close the report.
- If it continues, we may limit or suspend the activity to protect other people. We would rather not need to.

>! We do not share your private records with anyone who sends us a report.

You can read what is and is not allowed in our Acceptable Use Policy. Reply to this email with questions.
`),

  tpl(C, "dns-issue", "DNS problem affecting access", "Explain a domain or name-resolution problem", "alert",
    "A DNS problem is affecting access to OnboardOps", "Some people cannot reach the site. We are fixing it.",
    ["Follow live status", "{{status_url}}"], `
Hi {{name}},

A problem with DNS, the system that turns our web address into a server address, is stopping some people from reaching OnboardOps.

[details]
Started: {{start_time}} on {{date}}
Affects: {{affected}}
Reference: {{incident_id}}

## What you may see
Pages that will not load, or "site cannot be reached" messages. It may affect some networks and not others.

## What we are doing
{{what_happened}}

## What you can do
- Try mobile data or a different network.
- Wait a few minutes. Changes to DNS take time to spread, so recovery may be gradual.
- If you use a custom domain with OnboardOps, check your DNS records in your settings.

>+ Your data is safe. This is about reaching the service, not about the records stored in it.

We will tell you as soon as it is resolved.
`),

  tpl(C, "cert-problem", "Browser security warning", "Explain a certificate problem and what to do", "lock",
    "If your browser shows a security warning for OnboardOps", "Do not enter your password until we say it is fixed.",
    ["Check status", "{{status_url}}"], `
Hi {{name}},

Some people are seeing a security warning in their browser when opening OnboardOps. We are fixing a problem with our website's security certificate.

[details]
Started: {{start_time}} on {{date}}
Affects: {{affected}}
Reference: {{incident_id}}

>!! Until we confirm it is fixed, please do not enter your password if your browser warns you that the connection is not private.

## Why this happens
A certificate proves a website is who it says it is. If it is wrong or expired, browsers warn you. It is a safety feature, and it is behaving correctly.

## What we are doing
{{what_happened}}

## What you can do
1. Wait for our all-clear email or check {{status_url}}.
2. Do not click through the warning.
3. If you must act urgently, tell us and we will help another way.

We are sorry for the worry this causes.
`),

  tpl(C, "malware-blocked", "A file upload was blocked", "Tell a user a file was stopped as unsafe", "shield",
    "A file you uploaded to OnboardOps was blocked", "It looked unsafe, so we stopped it.",
    ["Review your uploads", "{{action_url}}"], `
Hi {{name}},

A file uploaded to {{workspace}} was blocked because our checks flagged it as unsafe or unsupported.

[details]
File name: {{credential}}
Time: {{time}} on {{date}}
Reference: {{incident_id}}

## What this means
- The file was not stored and cannot be opened by anyone in your workspace.
- Nothing else in your workspace was affected.

## What to do
1. If you did not expect this, scan the device it came from with security software.
2. If it was a genuine document, try saving it again as a PDF, or as a PNG or JPG for pictures, then upload it again.
3. Tell us if you believe this was a mistake, and include the reference.

## Why we check
Files in a workspace are shared with colleagues. Blocking unsafe ones keeps everyone's devices and records safer.
`),
];
