# OnboardOps Support Handbook

Owner: Alan (COO, Support lead). Backup: Jordan Daniels (founder). Review every quarter.

## 1. Purpose

Support is how customers experience OnboardOps. Our customers are small business owners and managers who are busy and often not technical, and their employees who use the product for training and checklists. This handbook sets how we answer, how fast, and what we may and may not do.

Principles:
1. **Be human, plain and brief.** No jargon, no blame.
2. **Own the problem.** The customer should never have to repeat themselves or chase us.
3. **Protect their data.** Verify before changing anything; do the minimum needed; record why.
4. **Tell the truth.** If we do not know, say so and say when we will.
5. **Fix the cause.** Repeat questions become help articles or product fixes.

## 2. Channels

- **Support email** (the support inbox in Zoho). The main channel.
- **Contact form** on the website, which arrives in the same inbox as a ticket.
- **Discord** (community and staff bot) for quick questions; anything involving an account moves to email.
- **Live notices** (maintenance banner, status messages) for outages.

We do not take support over phone or social media. Never ask a customer to send a password, full card number or a government ID by any channel.

## 3. Hours and response targets

| Priority | Examples | First reply | Aim to resolve |
|---|---|---|---|
| **Urgent** | Cannot sign in at all; data looks wrong or exposed; suspected account takeover; service down | 1 hour (waking hours), escalate to incident response at once | Same day |
| **High** | Feature broken, billing problem, locked-out employee on shift | 4 working hours | 1 working day |
| **Normal** | How-to, change request, setup help | 1 working day | 3 working days |
| **Low** | Feedback, feature ideas, general questions | 2 working days | Not applicable |

Set expectations honestly in the first reply. Put hours on the website and keep them true.

## 4. Verifying who you are talking to

Verification protects customers. The level depends on risk.

- **No verification needed:** general product questions and how-to.
- **Light:** the email comes from the address on the account (or a verified extra address). Fine for looking up status and explaining.
- **Strong (required for security-sensitive changes):** two-factor reset, email change, ownership transfer, deleting data, giving staff access, or lifting a ban. Do **at least two** of: reply from the account's email address; the workspace owner confirms from the owner's own address; the customer answers a question only they would know (workspace name plus last invoice, a recent audit entry, the date they created the account); the owner approves inside the product.

If someone says "I lost my phone and backup codes", the **workspace owner** can reset an employee's two-factor in the product. Owners reset their own with a backup code; if an owner has lost everything, use the strong process, wait a cooling-off period (24 hours), and email the old address before acting.

If you are not sure, do not act. Ask for more proof. Being slow is cheaper than being fooled.

## 5. The ticket lifecycle

1. **Read it all** and the customer's history.
2. **Triage:** priority, type, and whether it is an incident (many people affected means tell the incident lead).
3. **Reply** using the structure in section 6.
4. **Resolve** and say so; ask if there is anything else.
5. **Log** anything repeatable in the notes, and make it a help article if it is the third time we have seen it.
6. **Close** after 3 working days without a reply (send one gentle nudge on day 2).

Never leave a ticket without an owner or a next step. Stalled for any reason, tell the customer why and when we will update.

## 6. How to write a reply

Structure:
1. Greet by name. One line that shows you understood: "Thanks for letting us know the checklist will not save."
2. The answer or what you are doing, first. Not a history lesson.
3. Numbered steps if they need to do something.
4. What happens next and when.
5. Sign with your first name.

Voice: warm, direct, short sentences, no corporate phrases. Never say "unfortunately" three times, never blame the customer, never promise what product or engineering have not agreed.

Example, an apology:
> Hi Maria, sorry the invite email did not reach your new manager. I have sent a fresh one to the address you gave and checked it went out. If it is not in their inbox in ten minutes, ask them to look in spam, and tell me. I will keep this open until they are in.

## 7. Common requests and how to handle them

### Cannot sign in
1. Is it the right address? Ask them to try the sign-in link option ("email me a link") or a passkey if they have one.
2. Forgot password: the reset email. If it does not arrive, check the email log, then spam, then the other address on the account.
3. Account locked after failed attempts: it unlocks by itself after a short wait; explain and do not unlock by hand unless identity is verified.
4. Banned or suspended: do not discuss details in the first reply; see section 10.

### Two-factor problems
Backup codes first. Then the workspace owner reset. Then the strong-verification path in section 4. Always email the account owner when two-factor is reset.

### Passkeys
Passkeys live on the person's device or password manager. If they lost the device, they can sign in with their password or an email link and add a new passkey in Account settings. We cannot recover a passkey, only remove it.

### Invites and email not arriving
Check the email log for the send result. Common causes: wrong address, spam folder, company mail filter, an inbox that blocks new senders. Ask them to allow our sending address. If many people report it, this may be a deliverability incident: tell the incident lead.

### Workspace setup and "how do I"
Point to the exact screen, give the steps, and offer a short call or screenshare if they are stuck. For large setups, staff can set up a workspace for the customer using the staff tool.

### Billing and plan
Explain what they have, what changes, and when. Refunds and exceptions: Alan decides; record the reason. Never enter or ask for card details by email.

### Data export, correction and deletion requests
Customers own their data. The owner can export from the product. For a deletion or an access request about a person's data:
1. Verify strongly (section 4).
2. Check whether the requester is the employer (customer) or an individual employee. An employee asking to see or delete their employer's records should be pointed to the employer, who controls that data. Tell the employer we received the request if the law requires it.
3. Log the date, request and result. Keep within the deadlines in the privacy policy and the law (often 30 days).
4. If the request involves a legal matter, a regulator, or a lawyer, **stop and ask Jordan** before sending anything.

### Cancelling the service
Make it easy. Confirm what happens to data and when. Offer an export first. Ask why in one line; log the reason.

### Complaints
Reply within the urgent or high window. Acknowledge, apologise for the impact (not for facts we have not checked), fix what we can, say what changes. Alan owns the reply and Jordan sees every serious complaint.

### Bugs
Collect: what they did, what they expected, what happened, browser or device, time, and workspace name (not passwords). Try to reproduce. Tell the customer it is logged, give a workaround if there is one, and add it to the bug list with the ticket link. Update the customer when it is fixed.

### Feature requests
Thank them, say how we decide ("we add what many customers ask for"), log it with the customer's use case, and never promise a date.

## 8. Access to customer workspaces and data

- Look only at what you need to solve the problem. Curiosity is not a reason.
- Use the **customer-granted support access** where it exists, with a stated reason; do not browse workspaces otherwise.
- Staff actions are recorded in the audit log. Write a clear reason every time.
- Never copy customer data into chat tools, personal notes or AI tools that are not approved; never take screenshots that include other people's data and share them outside the team.
- Never ask for or store a customer's password. Never sign in as a customer.
- Personal data is shared only with the customer's own account holder, or with a lawful request that Jordan has approved.

## 9. Security and abuse reports

Anyone can report a security issue. Treat every report as real until shown otherwise.
1. Thank them; do not argue.
2. Do not forward details widely; send to the incident lead immediately (Alan to Jordan, or the reverse).
3. Acknowledge within 1 business day; give a timeline for an answer.
4. We do not threaten or penalise good-faith researchers. Ask them to give us time to fix before publishing.
5. Credit them if they want, once fixed.

Phishing, impersonation, harassment and illegal content reports: collect the evidence, use the moderation tools, and follow the incident handbook (abuse playbook).

## 10. Moderation, bans and appeals

- Reasons we act: abuse, fraud, harassment, illegal content, security attacks, non-payment after notice.
- Every action has a recorded reason, who decided, and when. Two staff agree for permanent bans where possible.
- Tell the person what rule was broken and how to appeal, without giving details that help them evade us.
- **Appeals:** read with fresh eyes (Alan if Jordan decided, and the reverse). Respond within 5 working days. If we were wrong, reverse it and say so.

## 11. Escalation

Escalate to the incident lead when:
- Two or more customers report the same serious problem.
- Personal data may have been seen by the wrong person.
- A customer reports an attack, takeover, or threat.
- The product is down or sign-in fails broadly.
- A regulator, lawyer or the press contacts us.

How: message the other staff member directly with: what, who, since when, ticket links. Then keep the customer informed using the incident handbook's wording. Do not guess at causes in front of customers.

## 12. Macros (starting set)

Save these as canned replies, then personalise the first line.

**Received, investigating**
> Hi [name], thanks for telling us. I am looking into [short description] now and will update you by [time]. If you have a screenshot or the exact time it happened, that helps.

**Need to verify**
> Hi [name], to keep your account safe I need to confirm it is you before I change this. Please reply from the email address on the account, and tell me [workspace name and the date you created it]. Once I have that I will do it straight away.

**Invite or reset email not arriving**
> Hi [name], I checked and we did send it at [time] to [address]. Please check spam and any company filters, and allow mail from our sending address. I have also sent a fresh one. If it still does not arrive, tell me and I will use another way in.

**Two-factor reset done**
> Hi [name], I reset two-factor on your account. Sign in and turn it on again in Account settings, and save the new backup codes somewhere safe. A passkey is a good second option.

**Fixed**
> Hi [name], that is fixed. [One line on what it was]. Thanks for your patience. Tell me if anything still looks wrong.

**Cannot do this**
> Hi [name], I understand why you would like that. We cannot do it because [honest reason]. What I can do is [alternative]. I have also noted your request.

**Closing nudge**
> Hi [name], I am closing this unless there is anything more I can help with. Reply any time and it reopens.

## 13. Quality and measures

Review a handful of tickets each week for: correct, kind, clear, secure. Track:
- First reply time and time to resolve (against section 3).
- Tickets by cause, so we can fix the top three causes each month.
- Repeat contacts and reopens.
- Customer satisfaction where we ask.
Report monthly to Jordan with the three things we will change.

## 14. Knowledge base

Every question we answer three times becomes a help article: title as the customer would say it, steps with screens, and what to do if it does not work. Check articles when the product changes. Link to articles in replies, and still answer the question in the reply.

## 15. Looking after ourselves

Support is draining. Be kind to yourself and each other. No one answers upset customers when angry; hand it to the other person. Take a real break after a difficult week. Tell Jordan if the load is too much; we fix the process or the staffing, not the person.
