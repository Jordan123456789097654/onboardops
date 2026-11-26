# Post-incident report template

Use this within 5 working days of any incident that affected customers. Publish a public version on the status page for incidents of Major or greater severity, and link it from the incident. Remove internal names and anything still under investigation before publishing.

---

## Summary
One paragraph. What happened, who was affected, for how long, and whether any customer data was involved. Write it so a customer can understand it without technical knowledge.

## Impact
- **Services affected:**
- **Start time (UTC):**
- **Resolved time (UTC):**
- **Duration:**
- **Customers affected:** number or "all" / "some"
- **Data impact:** state plainly: "No customer data was read, copied or changed" or describe exactly what was affected. Do not guess; if unknown, say it is still being investigated and when the next update will come.

## Timeline
| Time (UTC) | What happened |
|---|---|
| | First signal or alert |
| | Incident declared |
| | Cause identified |
| | Fix applied |
| | Service restored |
| | Monitoring complete |

## Cause
Plain explanation of the root cause. Separate the trigger (what started it) from the reason the impact was as large as it was.

## What we did
Actions taken during the incident, in order.

## What we are changing
For each change:
- **Change:**
- **Owner:**
- **Due date:**
- **How we will know it worked:**

## What customers should do
Only include actions customers actually need to take (for example, rotate an API key). Otherwise write "No action needed."

---

## Rules for writing this
- State facts only. Mark anything unconfirmed as unconfirmed.
- Do not name individual staff members or attackers.
- Do not promise outcomes or dates that have not been agreed.
- Legal, privacy and security wording must be reviewed by counsel before publication when customer data is involved.
- Approval: incident lead and one owner must approve before it is published.
