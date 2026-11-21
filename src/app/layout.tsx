import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  openGraph: { siteName: "OnboardOps", type: "website", url: "/" },
  title: { default: "OnboardOps — staff records, discipline and training in one place", template: "%s · OnboardOps" },
  description: "One employee record from day-one onboarding to disciplinary audit trails. Stop running HR out of spreadsheets and training out of group chats.",
};

const themeScript = `document.documentElement.classList.add('js');(function(){try{var t=localStorage.getItem('oo-theme');if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}else if(t!=='dark'){t='light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
