export type Step = { h: string; p: string[]; shot?: { name: string; url: string; alt: string } };
export type Guide = { slug: string; title: string; summary: string; steps: Step[] };

export const guides: Guide[] = [
  {
    slug: "from-spreadsheets",
    title: "Move from spreadsheets to OnboardOps",
    summary: "Bring your employee list, set up roles and start tracking training, checklists and policies in an afternoon.",
    steps: [
      { h: "Clean your employee sheet", p: ["Keep one row per person with these columns: Full name, Email, Phone, Department, Job role, Hire date and Emergency contact. Only Full name and Email are required.", "Use dates like 2026-11-02. Remove empty rows and merged cells. Save the sheet as a CSV file."] },
      { h: "Create your workspace and set up departments and job roles", p: ["Create a workspace, then open Settings and add your departments and job roles. Job roles can carry required courses, so new people are assigned the right training automatically.", "If you skip this, the import can create missing departments and job roles for you."], shot: { name: "settings", url: "/app/settings", alt: "The Settings page with departments and job roles" } },
      { h: "Import the CSV", p: ["Open Staff Directory and choose Import CSV. Pick your file. The importer matches columns by name, and you can match any it missed by hand. Preview the first rows, then import.", "The importer lists every row it skipped and why, such as a duplicate email."], shot: { name: "directory", url: "/app/directory", alt: "The Staff Directory with the Import CSV button" } },
      { h: "Check the result", p: ["Spot-check a few people. Fix mistakes on the employee page. Names, contact details and status can be edited at any time."] },
      { h: "Bring over what the spreadsheet tracked", p: ["Training: courses and quizzes start fresh. Record certificates people already hold as documents or credentials so you can track their expiry.", "Time off balances: set each person's yearly days on their page.", "Past discipline: you do not need to re-enter old write-ups. Keep the originals, attach them as documents if you must, and use cases going forward."] },
      { h: "Replace your checklists and sign-off sheets", p: ["Turn your shift checklists into templates and choose which days and times they repeat. Upload your handbook and policies, assign them to roles, and let people sign once.", "Employees then complete checklists and sign policies from their own portal."], shot: { name: "checklists", url: "/app/checklists", alt: "Shift checklist templates and completed logs" } },
      { h: "Invite your team", p: ["Send sign-in invites from Staff Accounts so each person chooses their own password. Give managers and supervisors the right role. Keep your spreadsheet read-only for a few weeks, then archive it once everything is confirmed."], shot: { name: "portal", url: "/app/my-portal", alt: "The employee portal" } },
    ],
  },
  {
    slug: "from-paper",
    title: "Move from paper to OnboardOps",
    summary: "Turn binders, sign-in sheets and clipboards into one searchable record, without retyping everything.",
    steps: [
      { h: "Decide what to bring over", p: ["You do not need to digitize everything. Start with the contact sheet and anything you must keep for legal reasons. Keep paper originals where the law requires them.", "For everything else, begin fresh from a start date and keep the old binders in storage."] },
      { h: "Type one contact sheet", p: ["Make a simple spreadsheet with Full name, Email, Phone, Department, Job role, Hire date and Emergency contact. Save it as CSV and import it. It is faster than adding people one by one.", "People without an email address can still have a record. Add their email later when they have one."], shot: { name: "directory", url: "/app/directory", alt: "The Staff Directory" } },
      { h: "Photograph or scan important documents", p: ["Upload licenses, signed forms and certificates to each person's documents. Mark anything sensitive as restricted so only owners and admins can see it. Do not upload items the Acceptable Use Policy forbids, such as Social Security cards or medical records."] },
      { h: "Replace sign-in sheets and clipboards", p: ["Create your checklists as templates. Employees tick items on their phone or a shared tablet, and supervisors verify them. A checklist finished without a connection is kept on the device and sent when it is back online."], shot: { name: "checklists", url: "/app/checklists", alt: "Shift checklists" } },
      { h: "Move policies and training", p: ["Upload your handbook and each policy as a PDF or text. Employees type their name to sign, and you can see who has not. Build short courses with quizzes for safety and procedures, or start from the built-in templates."], shot: { name: "course", url: "/app/training/course", alt: "The course player" } },
      { h: "Handle write-ups carefully", p: ["Old paper write-ups can stay in their files. From your start date, record new cases in the infraction ledger, where each employee can sign for receipt, add a response and appeal.", "If you must attach an old document to a person's record, add it as a restricted document."], shot: { name: "infractions", url: "/app/infractions", alt: "The infraction ledger" } },
      { h: "Run both for two weeks, then switch", p: ["Use the paper process and OnboardOps side by side for a short time. When people are comfortable, retire the clipboards and keep the binders only for what the law requires."] },
    ],
  },
];
export const guideBySlug = (s: string) => guides.find((g) => g.slug === s);
