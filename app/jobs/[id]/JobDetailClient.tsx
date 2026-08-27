"use client";
import { useEffect, useState } from "react";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import NavSidebar from "../../../components/NavSidebar";
import Footer from "../../../components/Footer";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { JobPostingSchema } from "@/components/JobPostingSchema";
import SimilarJobs from "./SimilarJobs";
import { sendPushToUser } from "@/lib/push-notifications";

interface Job {
  id: string;
  client_id: string;
  job_title: string;
  job_description: string;
  security_type: string;
  number_of_guards: number;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  urgency: string;
  sia_licence_required: boolean;
  required_licence_types: string[] | null;
  required_license_type?: string | null;
  experience_level: string | null;
  venue_name: string;
  venue_address_line1: string;
  venue_address_line2: string | null;
  venue_city: string;
  venue_postcode: string;
  uniform_required: boolean;
  uniform_details: string | null;
  additional_requirements: string | null;
  hourly_rate: number;
  payment_terms: string | null;
  status: string;
  views: number;
  created_at: string;
  clients: {
    id: string;
    company_name: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null;
}

function getJobLicenceTypes(job: Job): string[] | null {
  if (job.required_licence_types && job.required_licence_types.length > 0) {
    return job.required_licence_types;
  }
  if (job.required_license_type) {
    return [job.required_license_type];
  }
  return null;
}

export default function JobDetailClient({ jobId }: { jobId: string }) {
  const router = useSafeRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [guardProfile, setGuardProfile] = useState<any>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [canApply, setCanApply] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [blockType, setBlockType] = useState<string | null>(null);
  const [showGuardRequired, setShowGuardRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    const checkUserAndFetchJob = async () => {
      if (cancelled) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session) {
          setUser(session.user);

          const { data: guardData } = await supabase
            .from("guards")
            .select("id, verification_status, licence_types, sia_licence_number, sia_verified, full_name, email, phone, years_experience")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (cancelled) return;

          if (guardData) {
            setGuardProfile(guardData);
            setUserType("guard");

            const { data: applicationData } = await supabase
              .from("job_applications")
              .select("id, status")
              .eq("job_id", jobId)
              .eq("guard_id", guardData.id)
              .maybeSingle();
            if (cancelled) return;

            if (applicationData) {
              setHasApplied(true);
              setApplicationStatus(applicationData.status);
            }

            const { data: savedData } = await supabase
              .from("saved_jobs")
              .select("id")
              .eq("job_id", jobId)
              .eq("guard_id", guardData.id)
              .maybeSingle();
            if (cancelled) return;
            if (savedData) setIsSaved(true);
          } else {
            const { data: clientData } = await supabase
              .from("clients")
              .select("id")
              .eq("user_id", session.user.id)
              .maybeSingle();
            if (cancelled) return;

            if (clientData) {
              setUserType("client");
            }
          }
        }

        if (cancelled) return;
        await fetchJobDetails();
      } catch (error) {
        if (cancelled) return;
        console.error("Error checking user:", error);
        await fetchJobDetails();
      }
    };

    const fetchJobDetails = async () => {
      if (cancelled) return;
      try {
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select(`
            id,
            client_id,
            job_title,
            job_description,
            security_type,
            number_of_guards,
            start_date,
            end_date,
            start_time,
            end_time,
            urgency,
            sia_licence_required,
            required_licence_types,
            experience_level,
            venue_name,
            venue_address_line1,
            venue_address_line2,
            venue_city,
            venue_postcode,
            uniform_required,
            uniform_details,
            additional_requirements,
            hourly_rate,
            payment_terms,
            status,
            views,
            created_at,
            is_deleted,
            clients (
              id,
              company_name,
              email,
              first_name,
              last_name,
              phone
            )
          `)
          .eq("id", jobId)
          .eq("is_deleted", false)
          .maybeSingle();

        if (cancelled) return;

        if (jobError) {
          console.error("Supabase error:", jobError);
          setJob(null);
          return;
        }

        setJob(jobData || null);
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching job details:", error);
        setJob(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!jobId || jobId === "undefined" || jobId.trim() === "") {
      router.replace("/jobs");
      return;
    }
    checkUserAndFetchJob();

    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!job || !guardProfile || userType !== "guard") {
      setCanApply(false);
      return;
    }

    const status = guardProfile.verification_status;
    if (status !== "approved" && status !== "verified") {
      setCanApply(false);
      if (status === "pending") {
        setBlockType("pending");
        setBlockReason("Your guard profile is pending verification. You cannot apply until approved.");
      } else if (status === "rejected" || status === "declined") {
        setBlockType("declined");
        setBlockReason("Your guard profile was declined. You cannot apply for jobs.");
      } else {
        setBlockType("unverified");
        setBlockReason("Your guard profile is not verified. You cannot apply for jobs.");
      }
      return;
    }

    if (job.status !== "open") {
      setCanApply(false);
      setBlockType("closed");
      setBlockReason("This job is no longer open for applications.");
      return;
    }

    if (hasApplied) {
      setCanApply(false);
      setBlockReason(null);
      setBlockType(null);
      return;
    }

    const licenceTypes = getJobLicenceTypes(job);
    if (job.sia_licence_required && licenceTypes && licenceTypes.length > 0) {
      const guardLicences = guardProfile.licence_types || [];
      const hasRequired = licenceTypes.some((req: string) =>
        guardLicences.some((lic: string) => lic.toLowerCase() === req.toLowerCase())
      );
      if (!hasRequired) {
        setCanApply(false);
        setBlockType("licence");
        setBlockReason(`This job requires specific SIA licence types you do not hold: ${licenceTypes.join(", ")}.`);
        return;
      }
    }

    setCanApply(true);
    setBlockReason(null);
    setBlockType(null);
  }, [job, guardProfile, userType, hasApplied]);

  const handleApply = async () => {
    if (!user || !guardProfile) {
      router.push("/guard/login");
      return;
    }

    if (!canApply) {
      setToast({ message: blockReason || "You cannot apply for this job.", type: "error" });
      return;
    }

    setApplying(true);
    try {
      const { error: applicationError } = await supabase
        .from("job_applications")
        .insert({
          job_id: jobId,
          guard_id: guardProfile.id,
          cover_letter: applyMessage || null,
          cover_message: applyMessage || null,
          status: "pending",
          applied_at: new Date().toISOString(),
        });

      if (applicationError) {
        if (applicationError.code === "23505") {
          setHasApplied(true);
          setApplicationStatus("pending");
          setCanApply(false);
          setToast({ message: "You have already applied for this job.", type: "info" });
          setApplying(false);
          return;
        }
        throw applicationError;
      }

      try {
        const { data: jobData } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .maybeSingle();

        const { data: guardData } = await supabase
          .from("guards")
          .select("full_name, email, phone, years_experience, sia_licence_number")
          .eq("id", guardProfile.id)
          .maybeSingle();

        if (jobData && guardData) {
          const client = (jobData as any).clients;
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-job-application-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              clientEmail: client?.email,
              clientName: client?.company_name || `${client?.first_name} ${client?.last_name}`,
              guardName: `${guardData.full_name}`,
              jobTitle: jobData.job_title,
              jobVenue: (jobData as any).venue_name || "",
              jobDate: jobData.start_date ? new Date(jobData.start_date).toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "long", year: "numeric"
              }) : "",
              guardPhone: guardData.phone,
              guardEmail: guardData.email,
              guardExperience: guardData.years_experience || 0,
              siaLicense: guardData.sia_licence_number,
              coverLetter: applyMessage
            })
          });
        }
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
      }

      try {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("user_id")
          .eq("id", job?.client_id || "")
          .maybeSingle();

        if (clientRow?.user_id && job) {
          await supabase.from("notifications").insert({
            user_id: clientRow.user_id,
            user_type: "client",
            type: "job_application",
            title: "New Application Received",
            message: `${guardProfile?.full_name || "A guard"} applied for "${job.job_title}". Review and select guards.`,
            link: `/client/jobs/${jobId}/select-guards`,
            is_read: false,
          });

          await sendPushToUser(clientRow.user_id, "client", {
            title: "New Application Received",
            body: `${guardProfile?.full_name || "A guard"} applied for "${job.job_title}". Review and select guards.`,
            url: `/client/jobs/${jobId}/select-guards`,
            tag: "quickguard-application",
          });
        }
      } catch (notifyError) {
        console.error("Notification failed:", notifyError);
      }

      setShowApplyModal(false);
      setHasApplied(true);
      setApplicationStatus("pending");
      setCanApply(false);
      setToast({ message: "Application submitted successfully! The client has been notified.", type: "success" });
    } catch (error: any) {
      setToast({ message: "Error submitting application: " + error.message, type: "error" });
    } finally {
      setApplying(false);
    }
  };

  const handleSaveJob = async () => {
    if (!user || !guardProfile) {
      router.push("/guard/login");
      return;
    }
    try {
      if (isSaved) {
        const { error } = await supabase
          .from("saved_jobs")
          .delete()
          .eq("job_id", jobId)
          .eq("guard_id", guardProfile.id);
        if (error) throw error;
        setIsSaved(false);
        setToast({ message: "Job removed from saved list.", type: "info" });
      } else {
        const { error } = await supabase
          .from("saved_jobs")
          .insert({ job_id: jobId, guard_id: guardProfile.id });
        if (error) throw error;
        setIsSaved(true);
        setToast({ message: "Job saved! You can view it in your dashboard.", type: "success" });
      }
    } catch (error: any) {
      setToast({ message: error.message || "Could not save job.", type: "error" });
    }
  };

  const handleCopyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "immediate":
        return "bg-red-500/15 text-red-400 border border-red-500/30";
      case "urgent":
        return "bg-orange-500/15 text-orange-400 border border-orange-500/30";
      default:
        return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "immediate":
        return "ri-error-warning-line";
      case "urgent":
        return "ri-alarm-warning-line";
      default:
        return "ri-time-line";
    }
  };

  const getExpiryBadge = (startDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const diffMs = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null;

    if (diffDays === 0) {
      return { label: "Closes Today", classes: "bg-red-600 text-white", icon: "ri-alarm-warning-fill" };
    } else if (diffDays === 1) {
      return { label: "Closes Tomorrow", classes: "bg-red-500 text-white", icon: "ri-timer-flash-line" };
    } else if (diffDays <= 3) {
      return { label: `Closes in ${diffDays} days`, classes: "bg-orange-500 text-white", icon: "ri-timer-line" };
    } else if (diffDays <= 7) {
      return { label: `Closes in ${diffDays} days`, classes: "bg-amber-400 text-amber-900", icon: "ri-time-line" };
    }
    return null;
  };

  const getApplicationStatusUI = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "Application Pending", classes: "bg-amber-500/15 text-amber-400 border border-amber-500/30", icon: "ri-time-line" };
      case "reviewed":
        return { label: "Under Review", classes: "bg-blue-500/15 text-blue-400 border border-blue-500/30", icon: "ri-eye-line" };
      case "accepted":
      case "confirmed":
        return { label: "Application Accepted", classes: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30", icon: "ri-checkbox-circle-line" };
      case "declined":
      case "rejected":
        return { label: "Application Declined", classes: "bg-red-500/15 text-red-400 border border-red-500/30", icon: "ri-close-circle-line" };
      case "shortlisted":
        return { label: "Shortlisted", classes: "bg-blue-500/15 text-blue-400 border border-blue-500/30", icon: "ri-star-line" };
      case "withdrawn":
        return { label: "Withdrawn", classes: "bg-slate-500/15 text-slate-400 border border-slate-500/30", icon: "ri-arrow-go-back-line" };
      default:
        return { label: "Application Submitted", classes: "bg-slate-500/15 text-slate-400 border border-slate-500/30", icon: "ri-question-line" };
    }
  };

  const getBlockedCard = () => {
    switch (blockType) {
      case "pending":
        return { icon: "ri-time-line", title: "Profile under review", actionLabel: "Check my status", actionHref: "/guard/verification-pending" };
      case "declined":
        return { icon: "ri-close-circle-line", title: "Profile declined", actionLabel: "Learn more", actionHref: "/guard/verification-failed" };
      case "unverified":
        return { icon: "ri-shield-check-line", title: "Verification required", actionLabel: "Complete my profile", actionHref: "/guard/complete-profile-wizard" };
      case "closed":
        return { icon: "ri-error-warning-line", title: "Job closed", actionLabel: "Browse other jobs", actionHref: "/jobs" };
      case "licence":
        return { icon: "ri-shield-star-line", title: "Missing SIA licence", actionLabel: "Update my licence", actionHref: "/guard/profile" };
      default:
        return { icon: "ri-error-warning-line", title: "Cannot apply", actionLabel: "Back to jobs", actionHref: "/jobs" };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const calculateTotalPay = () => {
    if (!job || !job.start_time || !job.end_time) return null;

    const [startHour, startMin] = job.start_time.split(":").map(Number);
    const [endHour, endMin] = job.end_time.split(":").map(Number);

    let hours = endHour - startHour;
    let minutes = endMin - startMin;

    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }

    if (hours < 0) {
      hours += 24;
    }

    const totalHours = hours + minutes / 60;
    const totalPay = totalHours * job.hourly_rate;

    return {
      hours: totalHours.toFixed(1),
      pay: totalPay.toFixed(2)
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933]">
        <NavSidebar />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading job details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0B1933]">
        <NavSidebar />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-12">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <i className="ri-file-search-line text-4xl text-red-400"></i>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Job Not Found</h1>
            <p className="text-slate-400 mb-2 text-lg">This job listing is no longer available.</p>
            <p className="text-slate-500 text-sm mb-8">
              It may have been filled, removed, or the link may be incorrect. Browse our current openings below.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center gap-2 bg-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-400 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-briefcase-line"></i>
                Browse All Jobs
              </Link>
              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center gap-2 bg-[#162036] text-slate-300 px-6 py-3 rounded-lg font-semibold hover:bg-[#1a2642] transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
                Go Back
              </button>
            </div>
            <div className="mt-8 pt-8 border-t border-slate-800/60">
              <p className="text-sm text-slate-500 mb-3">Looking for something specific?</p>
              <Link
                href="/contact"
                className="text-teal-400 hover:text-teal-300 text-sm font-medium underline underline-offset-2"
              >
                Contact our support team
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const totalPay = calculateTotalPay();
  const blockedCard = getBlockedCard();

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] max-w-md w-full px-4">
          <div className={`rounded-xl px-5 py-4 shadow-lg border flex items-center gap-3 ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : toast.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
          }`}>
            <i className={`text-xl ${
              toast.type === "success" ? "ri-checkbox-circle-line text-emerald-400"
              : toast.type === "error" ? "ri-error-warning-line text-red-400"
              : "ri-information-line text-blue-400"
            }`}></i>
            <p className="text-sm font-medium">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-auto text-slate-500 hover:text-slate-300">
              <i className="ri-close-line"></i>
            </button>
          </div>
        </div>
      )}

      {job && (
        <JobPostingSchema
          job={{
            id: job.id,
            title: job.job_title,
            description: job.job_description,
            location: job.venue_city,
            postcode: job.venue_postcode,
            hourly_rate: job.hourly_rate,
            start_date: job.start_date,
            end_date: job.end_date,
            created_at: job.created_at,
            sia_licence_required: job.sia_licence_required,
            clients: job.clients ? { company_name: job.clients.company_name } : null
          }}
        />
      )}

      <section className="relative pt-32 pb-20 bg-[#0e1628] border-b border-slate-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          {guardProfile && userType === "guard" && (
            <Link
              href="/guard/dashboard"
              className="inline-flex items-center gap-2 bg-[#162036] hover:bg-[#1a2642] border border-slate-700/50 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium mb-4 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Guard Dashboard
            </Link>
          )}
          {userType === "client" && (
            <Link
              href="/client/dashboard"
              className="inline-flex items-center gap-2 bg-[#162036] hover:bg-[#1a2642] border border-slate-700/50 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium mb-4 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Client Dashboard
            </Link>
          )}
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            Back to All Jobs
          </Link>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-white">{job.job_title}</h1>
                {job.urgency && (
                  <span className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${getUrgencyBadge(job.urgency)}`}>
                    <i className={`${getUrgencyIcon(job.urgency)} mr-1`}></i>
                    {job.urgency.charAt(0).toUpperCase() + job.urgency.slice(1)}
                  </span>
                )}
                {(() => {
                  const expiry = getExpiryBadge(job.start_date);
                  return expiry ? (
                    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${expiry.classes}`}>
                      <i className={expiry.icon} aria-hidden="true"></i>
                      {expiry.label}
                    </span>
                  ) : null;
                })()}
                {applicationStatus && (
                  (() => {
                    const as = getApplicationStatusUI(applicationStatus);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${as.classes}`}>
                        <i className={as.icon}></i>
                        {as.label}
                      </span>
                    );
                  })()
                )}
              </div>
              <p className="text-xl text-slate-400 mb-2">
                {job.clients?.company_name || "Private Client"}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1">
                  <i className="ri-map-pin-line"></i>
                  {job.venue_name}, {job.venue_city}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-calendar-line"></i>
                  {formatDate(job.start_date)}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-time-line"></i>
                  {job.start_time} - {job.end_time}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-5xl font-bold text-teal-400 mb-1">£{Number(job.hourly_rate).toFixed(2)}</div>
              <p className="text-slate-400 text-lg">per hour</p>
              {totalPay && (
                <p className="text-slate-500 text-sm mt-2">
                  Est. £{totalPay.pay} for {totalPay.hours}hrs
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <i className="ri-file-text-line text-teal-400"></i>
                Job Description
              </h2>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {job.job_description}
              </p>
            </div>

            <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <i className="ri-map-pin-line text-teal-400"></i>
                Location Details
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <i className="ri-building-line text-teal-400 text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-white">Venue</p>
                    <p className="text-slate-300">{job.venue_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <i className="ri-road-map-line text-teal-400 text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-white">Address</p>
                    <p className="text-slate-300">
                      {job.venue_address_line1}
                      {job.venue_address_line2 && <><br />{job.venue_address_line2}</>}
                      <br />
                      {job.venue_city}, {job.venue_postcode}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <i className="ri-shield-check-line text-teal-400"></i>
                Requirements
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <i className="ri-checkbox-circle-fill text-teal-400 text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-white">SIA Licence</p>
                    <p className="text-slate-300">
                      {job.sia_licence_required ? "Required" : "Not Required"}
                    </p>
                  </div>
                </div>

                {job.required_licence_types && job.required_licence_types.length > 0 && (
                  <div className="flex items-start gap-3">
                    <i className="ri-shield-star-line text-teal-400 text-xl mt-1"></i>
                    <div>
                      <p className="font-semibold text-white">Required Licence Types</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {job.required_licence_types.map((licence, idx) => (
                          <span key={idx} className="bg-teal-500/10 text-teal-400 px-3 py-1 rounded-full text-sm">
                            {licence}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {job.experience_level && (
                  <div className="flex items-start gap-3">
                    <i className="ri-user-star-line text-teal-400 text-xl mt-1"></i>
                    <div>
                      <p className="font-semibold text-white">Experience Level</p>
                      <p className="text-slate-300">
                        {job.experience_level.charAt(0).toUpperCase() + job.experience_level.slice(1)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <i className="ri-t-shirt-line text-teal-400 text-xl mt-1"></i>
                  <div>
                    <p className="font-semibold text-white">Uniform</p>
                    <p className="text-slate-300">
                      {job.uniform_required ? "Required" : "Not Required"}
                    </p>
                    {job.uniform_details && (
                      <p className="text-slate-400 text-sm mt-1">{job.uniform_details}</p>
                    )}
                  </div>
                </div>

                {job.additional_requirements && (
                  <div className="flex items-start gap-3">
                    <i className="ri-list-check text-teal-400 text-xl mt-1"></i>
                    <div>
                      <p className="font-semibold text-white">Additional Requirements</p>
                      <p className="text-slate-300 whitespace-pre-line">{job.additional_requirements}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Job Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Security Type</span>
                    <span className="font-semibold text-white text-sm">
                      {job.security_type.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Guards Needed</span>
                    <span className="font-semibold text-white text-sm">
                      {job.number_of_guards}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Start Date</span>
                    <span className="font-semibold text-white text-sm">
                      {new Date(job.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {job.end_date && (
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                      <span className="text-slate-400 text-sm">End Date</span>
                      <span className="font-semibold text-white text-sm">
                        {new Date(job.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Shift Time</span>
                    <span className="font-semibold text-white text-sm">
                      {job.start_time} - {job.end_time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Hourly Rate</span>
                    <span className="font-semibold text-teal-400 text-sm">
                      £{Number(job.hourly_rate).toFixed(2)}/hr
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Status</span>
                    <span className={`font-semibold text-sm ${job.status === "open" ? "text-emerald-400" : "text-amber-400"}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                    <span className="text-slate-400 text-sm">Posted</span>
                    <span className="font-semibold text-white text-sm">
                      {new Date(job.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {hasApplied ? (
                  <div className="w-full bg-emerald-500/10 text-emerald-400 py-4 rounded-lg font-bold text-lg mt-6 whitespace-nowrap flex items-center justify-center gap-2 border border-emerald-500/20">
                    <i className="ri-checkbox-circle-line"></i>
                    {(() => {
                      const as = getApplicationStatusUI(applicationStatus || "pending");
                      return as.label;
                    })()}
                  </div>
                ) : showGuardRequired ? (
                  <div className="mt-6 p-5 bg-teal-500/10 border border-teal-400/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="ri-shield-user-line text-xl text-teal-400"></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white mb-1">Guard account required</h4>
                        <p className="text-sm text-slate-400 mb-4">
                          {userType === "client"
                            ? "You're signed in as a client. You need a security guard account to apply for jobs."
                            : "You need a security guard account to apply for jobs. Sign in or create one below."}
                        </p>
                        <div className="flex flex-col gap-2">
                          <Link
                            href="/guard/login"
                            className="block w-full bg-teal-500 hover:bg-teal-400 text-slate-900 text-center py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Sign In as Guard
                          </Link>
                          <Link
                            href="/guard/register"
                            className="block w-full bg-[#162036] hover:bg-[#1a2642] text-slate-300 text-center py-3 rounded-lg font-semibold transition-colors whitespace-nowrap border border-slate-700/50 cursor-pointer"
                          >
                            Create Guard Account
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : blockReason && userType === "guard" ? (
                  <div className="mt-6 p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`${blockedCard.icon} text-xl text-amber-400`}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white mb-1">{blockedCard.title}</h4>
                        <p className="text-sm text-slate-400 mb-4">{blockReason}</p>
                        <Link
                          href={blockedCard.actionHref}
                          className="block w-full bg-teal-500 hover:bg-teal-400 text-slate-900 text-center py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {blockedCard.actionLabel}
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!user || userType !== "guard") {
                        setShowGuardRequired(true);
                      } else if (!canApply) {
                        setToast({ message: blockReason || "You cannot apply for this job.", type: "error" });
                      } else {
                        setShowApplyModal(true);
                      }
                    }}
                    className="w-full bg-teal-500 text-white py-4 rounded-lg font-bold text-lg hover:bg-teal-400 transition-colors mt-6 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="ri-send-plane-line"></i>
                    Apply for This Job
                  </button>
                )}

                <button
                  onClick={handleSaveJob}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors mt-3 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer ${
                    isSaved
                      ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                      : "bg-[#162036] text-slate-300 hover:bg-[#1a2642]"
                  }`}
                >
                  <i className={isSaved ? "ri-bookmark-fill" : "ri-bookmark-line"}></i>
                  {isSaved ? "Saved" : "Save Job"}
                </button>

                <button
                  onClick={handleCopyLink}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors mt-3 whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer ${
                    linkCopied
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[#162036] text-slate-300 hover:bg-[#1a2642]"
                  }`}
                >
                  <i className={linkCopied ? "ri-checkbox-circle-line" : "ri-links-line"}></i>
                  {linkCopied ? "Link Copied!" : "Copy Job Link"}
                </button>

              </div>

              <div className="bg-[#0e1628] border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-lightbulb-line text-xl text-white"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-2">Application Tips</h4>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-start gap-2">
                        <i className="ri-checkbox-circle-fill text-teal-400 mt-0.5"></i>
                        <span>Apply early to increase your chances</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-checkbox-circle-fill text-teal-400 mt-0.5"></i>
                        <span>Ensure your SIA licence is up to date</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-checkbox-circle-fill text-teal-400 mt-0.5"></i>
                        <span>Write a personalized cover letter</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-checkbox-circle-fill text-teal-400 mt-0.5"></i>
                        <span>Highlight relevant experience</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                  <i className="ri-question-line text-teal-400"></i>
                  Need Help?
                </h4>
                <p className="text-sm text-slate-400 mb-4">
                  Have questions about this job? Contact our support team.
                </p>
                <Link
                  href="/contact"
                  className="block text-center bg-[#162036] text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-[#1a2642] transition-colors whitespace-nowrap"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800/60 bg-[#0B1933] py-4 mb-4">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <i className="ri-compass-discover-line text-teal-400"></i>
            <span>You might also be interested in these opportunities</span>
          </div>
        </div>
      </div>

      <SimilarJobs
        currentJobId={job.id}
        securityType={job.security_type}
        venueCity={job.venue_city}
      />

      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-white mb-4">Apply for this Job</h3>
            <p className="text-slate-400 mb-4">Applying for: <span className="font-semibold text-white">{job.job_title}</span></p>
            <textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Tell the client why you're the best fit for this job..."
              className="w-full bg-[#0e1628] border border-slate-700/50 rounded-lg p-4 mb-2 h-32 resize-none text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              maxLength={500}
            />
            <p className="text-sm text-slate-500 mb-4">{applyMessage.length}/500 characters</p>
            <div className="flex gap-3">
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                {applying ? "Submitting..." : "Submit Application"}
              </button>
              <button
                onClick={() => setShowApplyModal(false)}
                className="flex-1 bg-[#162036] hover:bg-[#1a2642] text-slate-300 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}