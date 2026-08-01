import type { Metadata } from "next";
import JobsPageContent from "./JobsPageContent";

export const metadata: Metadata = {
  title: "Security Guard Jobs UK | Hire SIA Licensed Guards",
  description:
    "Browse 500+ SIA-licensed security guard jobs across London, Manchester, Birmingham & the UK. Event, retail, corporate security. Instant booking with verified professionals.",
  keywords:
    "security guard jobs UK, SIA licensed jobs, hire security guards, event security jobs, door supervisor jobs, security jobs London, security work UK",
  alternates: {
    canonical: "https://quickguard.uk/jobs",
  },
  openGraph: {
    title: "Security Guard Jobs UK | QuickGuard",
    description:
      "Browse SIA-licensed security guard jobs across the UK. Event, retail, and corporate security positions with verified professionals.",
    url: "https://quickguard.uk/jobs",
    siteName: "QuickGuard",
    type: "website",
  },
};

export default function JobsPage() {
  return <JobsPageContent />;
}