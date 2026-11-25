# OnboardOps Staff and Operations Handbook

Owner: Jordan Daniels (founder). Operations lead: Alan (COO). Review every quarter.

## 1. Who we are and what we do
OnboardOps helps small businesses train new hires, keep policies and checklists, and track certifications and credentials. We are a small team: we do many jobs and cover each other. Everything in this handbook exists to keep customers' trust and our own sanity.

## 2. Values
1. **Customers first, honestly.** We say what we can do and what we cannot.
2. **Keep it simple.** Simple for customers, simple for us.
3. **Own it.** Whoever sees a problem starts fixing it or hands it over clearly.
4. **Protect data.** Every decision is checked against "would we be comfortable explaining this to the customer?"
5. **Learn in the open.** Mistakes become reviews and better habits.

## 3. Roles
- **Jordan Daniels, Founder.** Product, engineering, security, legal, finance, incident lead.
- **Alan, COO and Support Lead.** Support, operations, communications lead and deputy incident lead.
When roles change, update this page, the Incident Response Handbook (roles and contacts) and the Security and Access Handbook (access table) the same day.

## 4. How we work together
- **Daily:** a short written note to each other: what you did, what you are doing, anything blocking. Check the support inbox and alerts.
- **Weekly (30 minutes):** review tickets, incidents, the bug list, the audit log, outreach results and the plan for the next week.
- **Monthly:** a one-page report: customers, support numbers, incidents, cash, what we will change.
- **Quarterly:** readiness review (drill, restore test, access review, handbook updates).
- Decide in writing for anything that affects customers, money, security or the law. If we disagree, Jordan decides on product, security and legal; Alan decides on support and customer relationships; both agree on spending.

## 5. Availability and on-call
- Normal hours are posted on the website. Outside hours, alerts for SEV 1 and 2 reach both of us.
- Agree who is the primary responder each week. Swap whenever you need. Tell the other person before you travel or switch off.
- If you cannot be reached, the other person holds both roles and uses vendor support.
- Take real time off. Plan holidays so one of us is always reachable.

## 6. Tools
| Purpose | Tool |
|---|---|
| Product and admin | The product and its staff console |
| Hosting and deploys | Vercel |
| Database | Neon (Postgres) |
| Product email | Resend |
| Staff and support email | Zoho Mail |
| Monitoring | Better Stack |
| Passwords and recovery codes | Our password manager |
| Community | Discord |
Do not add a new tool that touches customer data without checking the Data Protection Handbook (subprocessors) first.

## 7. Change management
1. Describe the change and why. Judge the risk (customers, data, money).
2. Review (a second person, or a wait and a re-read).
3. Test locally and check types.
4. Deploy at a quiet time, watch monitoring for 30 minutes, know the rollback.
5. Note it in the changelog if customers can see it.
Emergency fixes skip step 2 only for an incident, and are reviewed afterwards.

## 8. Customer lifecycle
- **Setup:** staff can create a workspace for a customer, attach the owner, send the invite and add starter content as drafts to review.
- **Onboarding:** reply to new owners within a day; offer a short call; check they invited staff within a week.
- **Health:** each month, look at who has not signed in or has no published course and write to them kindly.
- **Cancelling:** make it easy; export offered; ask why; log it.

## 9. Money
- Owner approves spending. Keep receipts. Review subscriptions every quarter and cancel what we do not use.
- Customers' payment details are handled only by the payment provider, never by us.
- Refunds and exceptions are decided by Alan with a recorded reason, and by Jordan above a set amount.

## 10. Outreach and marketing
Follow the Data Protection Handbook section 9. Send small, honest batches; track replies and opt-outs in the tracker; follow up once after four days, then stop; never email someone who opted out. Watch the bounce rate; if mail starts to be delayed or rejected, stop and fix authentication before sending more.

## 11. Business continuity
- **Backups:** the database provider keeps point-in-time history. Test a restore twice a year.
- **Code:** lives in the repository. Know how to redeploy from scratch.
- **Accounts:** recovery codes in the password manager, plus a sealed offline copy.
- **Single points of failure:** list them (one person, one vendor, one domain) and decide which to reduce each quarter.
- **If we both are unavailable:** a trusted person named by Jordan holds a sealed instruction sheet with where to find vendor logins and who to call.

## 12. Compliance and records
Keep: current policies and notices, subprocessor list, incident reviews, access reviews, training certificates for staff, and request logs. Review each quarter. When the law or our practice changes, update the policy before the change goes live, and give customers the notice our agreement requires.

## 13. Staff training
Every staff member completes, within their first two weeks and then yearly: Security and Access Basics, Data Protection and Privacy, Support Excellence (support staff), and Incident Response Fundamentals. Incident leads complete the Incident Commander certification. Certificates are tracked in this workspace.

## 14. Onboarding a new staff member (checklist)
1. Create their named accounts; turn on two-factor and a passkey; set up the password manager.
2. Grant the least access they need (Security and Access Handbook section 3).
3. They read all handbooks and complete the required courses.
4. Walk through a past incident and a support case together.
5. Shadow for a week, then work with review, then work alone.
6. Add them to alerts and the on-call plan.

## 15. Offboarding
Remove access the same day; rotate shared secrets; recover devices; transfer ownership; thank them; write down what they knew.
