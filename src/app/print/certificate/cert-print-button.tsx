"use client";
import { Printer } from "lucide-react";

export function CertPrintButton() {
  return <button className="btn-primary" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</button>;
}
