/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const aliases: Record<string, string> = {
  name: "fullName", fullname: "fullName", "full name": "fullName", employee: "fullName", "employee name": "fullName",
  email: "email", "work email": "email", "e-mail": "email",
  phone: "phone", "phone number": "phone", mobile: "phone",
  "emergency contact": "emergencyContact", emergency: "emergencyContact", emergencycontact: "emergencyContact",
  department: "department", dept: "department",
  "job role": "jobRole", jobrole: "jobRole", role: "jobRole", title: "jobRole", position: "jobRole", "job title": "jobRole",
  "hire date": "hireDate", hiredate: "hireDate", "start date": "hireDate", hired: "hireDate",
};

export type ParsedImport = { rows: Record<string, string>[]; unmapped: string[]; missingRequired: string[] };

export const IMPORT_FIELDS: { key: string; label: string }[] = [
  { key: "fullName", label: "Full name" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "department", label: "Department" },
  { key: "jobRole", label: "Job role" }, { key: "hireDate", label: "Hire date" }, { key: "emergencyContact", label: "Emergency contact" },
];

/** Header cells and the field each one maps to automatically ("" = ignored). */
export function csvHeaders(text: string): { headers: string[]; auto: string[] } {
  const grid = parseCsv(text);
  const headers = (grid[0] ?? []).map((h) => h.trim());
  return { headers, auto: headers.map((h) => aliases[h.toLowerCase()] ?? "") };
}

export function mapEmployeeCsv(text: string, override?: string[]): ParsedImport {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [], unmapped: [], missingRequired: ["fullName", "email"] };
  const head = grid[0].map((h, i) => (override ? override[i] ?? "" : aliases[h.trim().toLowerCase()] ?? ""));
  const unmapped = grid[0].filter((_, i) => !head[i]).map((h) => h.trim()).filter(Boolean);
  const missingRequired = ["fullName", "email"].filter((k) => !head.includes(k));
  const rows = grid.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    head.forEach((k, i) => { if (k) o[k] = (cells[i] ?? "").trim(); });
    return o;
  });
  return { rows, unmapped, missingRequired };
}

export const EMPLOYEE_CSV_TEMPLATE = "Full name,Email,Phone,Department,Job role,Hire date,Emergency contact\nJordan Ellis,jordan.ellis@example.com,404-555-0142,Warehouse,Picker / Packer,2026-11-02,Casey Ellis 404-555-0199\n";
