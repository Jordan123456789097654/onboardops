export const SITE = {
  name: "OnboardOps",
  /** Set NEXT_PUBLIC_CONTACT_EMAIL in .env to show a real address on the Contact and legal pages. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  legalEntity: process.env.NEXT_PUBLIC_LEGAL_ENTITY || "OnboardOps",
  state: "Georgia",
  domain: "onboardops.org",
  /** Public base URL. Production sets APP_URL=https://onboardops.org; local development uses http://localhost:3000. */
  url: process.env.APP_URL || "http://localhost:3000",
  legalUpdated: "November 26, 2026",
};

export const legalPages = [
  { href: "/legal/terms-of-service", label: "Terms of Service" },
  { href: "/legal/terms-of-use", label: "Terms of Use" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/acceptable-use", label: "Acceptable Use Policy" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal/data-processing", label: "Data Processing Addendum" },
  { href: "/legal/beta-terms", label: "Beta Program Terms" },
  { href: "/legal/employee-notice", label: "Employee Privacy Notice" },
  { href: "/legal/retention", label: "Data Retention and Deletion" },
];
