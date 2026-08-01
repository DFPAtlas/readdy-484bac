"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useClientGuard } from "@/hooks/useClientGuard";
import { useRouteGuard } from "@/hooks/useRouteGuard";
import UpgradePrompt from "@/components/UpgradePrompt";
import { sendPushToUser } from "@/lib/push-notifications";
import RealtimeToast, { showRealtimeToast } from "@/components/RealtimeToast";
import PortalSidebar from "@/components/PortalSidebar";
import ApplicantDashboardHeader from "./ApplicantDashboardHeader";
import ApplicantCard from "./ApplicantCard";
import SearchFilterBar from "../../../components/SearchFilterBar";
import SelectedGuardsPanel from "./SelectedGuardsPanel";
import GuardProfileModal from "./GuardProfileModal";
import ConfirmSelectionModal from "./ConfirmSelectionModal";
import MessageGuardModal from "./MessageGuardModal";
import WarningBanner from "./WarningBanner";
import BulkActionBar from "../../../components/BulkActionBar";
import JobCompliancePanel from "../compliance/JobCompliancePanel";
import ComplianceWarnings from "../compliance/ComplianceWarnings";
import { computeComplianceInfo, GuardComplianceData } from "../compliance/useCompliance";
import CompareGuardsModal from "./CompareGuardsModal";
import CompareSelectionBar from "./CompareSelectionBar";
import ContextualHelpCard from "@/app/client/help/ContextualHelpCard";
import { canSendJobMessage } from '@/lib/message-permissions';

interface Guard {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  hourly_rate: number | null;
  years_experience: number | null;
  sia_verified: boolean;
  sia_expiry_date: string | null;
  sia_licence_number: string | null;
  licence_types: string[] | null;
  specializations: string[] | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  has_transport: boolean | null;
  availability_status: string | null;
  languages: string[] | null;
  cover_message: string | null;
  applied_at: string | null;
  distance_km: number | null;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  sia_licence_front_url?: string | null;
  sia_licence_back_url?: string | null;
  profile_completed?: boolean | null;
  verification_status?: string | null;
  certifications?: string[] | null;
  sia_verified_at?: string | null;
}

interface Job {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  venue_postcode: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  number_of_guards: number;
  status: string;
  sia_licence_required: boolean;
  latitude: number | null;
  required_licence_types?: string[] | null;
  required_license_type?: string | null;
}

interface ApplicationStatus {
  shortlisted: boolean;
  status: string;
  cover_message: string | null;
  applied_at: string | null;
}

interface Assignment {
  id: string;
  guard_id: string;
  status: string;
}

type WarningType =
  | "expired_sia"
  | "near_expiry_sia"
  | "understaffed"
  | "overstaffed"
  | "payment_required"
  | "already_booked";

interface Warning {
  type: WarningType;
  message: string;
  guardName?: string;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getJobLicenceTypes(job: Job | null): string[] | null {
  if (!job) return null;
  if (job.required_licence_types && job.required_licence_types.length > 0) {
    return job.required_licence_types;
  }
  if (job.required_license_type) {
    return [job.required_license_type];
  }
  return null;
}

const defaultFilters = {
  siaLicence: "",
  distance: "",
  rating: "",
  experience: "",
  availability: "",
  sortBy: "rating",
  compliance: "",
};

const GUARD_SORT_OPTIONS = [
  { value: "best_match", label: "Best Match" },
  { value: "rating", label: "Highest Rated" },
  { value: "distance", label: "Closest" },
  { value: "experience", label: "Most Experienced" },
  { value: "rate_low", label: "Lowest Rate" },
  { value: "rate_high", label: "Highest Rate" },
  { value: "newest", label: "Newest Applied" },
  { value: "compliance", label: "Highest Compliance" },
];

const GUARD_FILTER_CONFIGS = [
  {
    key: "siaLicence",
    label: "SIA Licence",
    type: "select" as const,
    options: [
      { value: "verified", label: "SIA Verified" },
      { value: "door_supervisor", label: "Door Supervisor" },
      { value: "security_guard", label: "Security Guard" },
      { value: "close_protection", label: "Close Protection" },
      { value: "cctv", label: "CCTV" },
    ],
  },
  {
    key: "compliance",
    label: "Compliance",
    type: "select" as const,
    options: [
      { value: "fully_compliant", label: "Fully Compliant" },
      { value: "sia_verified", label: "SIA Verified" },
      { value: "expiring_soon", label: "Expiring Soon" },
      { value: "missing_docs", label: "Missing Docs" },
      { value: "licence_match", label: "Licence Match" },
      { value: "needs_review", label: "Needs Review" },
    ],
  },
  {
    key: "distance",
    label: "Distance",
    type: "select" as const,
    options: [
      { value: "5", label: "Under 5 km" },
      { value: "10", label: "Under 10 km" },
      { value: "20", label: "Under 20 km" },
      { value: "50", label: "Under 50 km" },
    ],
  },
  {
    key: "rating",
    label: "Rating",
    type: "select" as const,
    options: [
      { value: "4.5", label: "4.5+ stars" },
      { value: "4", label: "4.0+ stars" },
      { value: "3.5", label: "3.5+ stars" },
      { value: "3", label: "3.0+ stars" },
    ],
  },
  {
    key: "experience",
    label: "Experience",
    type: "select" as const,
    options: [
      { value: "5", label: "5+ years" },
      { value: "3", label: "3+ years" },
      { value: "1", label: "1+ year" },
      { value: "0", label: "New guard" },
    ],
  },
  {
    key: "availability",
    label: "Availability",
    type: "select" as const,
    options: [
      { value: "available", label: "Available" },
      { value: "full_time", label: "Full Time" },
      { value: "part_time", label: "Part Time" },
      { value: "weekends", label: "Weekends" },
    ],
  },
];

export default function SelectGuardsClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [allGuards, setAllGuards] = useState<Guard[]>([]);
  const [applicantStatuses, setApplicantStatuses] = useState<Record<string, ApplicationStatus>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [selectedGuardIds, setSelectedGuardIds] = useState<Set<string>>(new Set());
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showAllGuards, setShowAllGuards] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);

  const [filters, setFilters] = useState(defaultFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("");

  const [profileGuard, setProfileGuard] = useState<Guard | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [messageGuard, setMessageGuard] = useState<Guard | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [companyName, setCompanyName] = useState("Client");
  const [subscriptionTier, setSubscriptionTier] = useState("Basic");
  const [initials, setInitials] = useState("CL");
  const [clientId, setClientId] = useState<string>("");

  const [toast, setToast] = useState("");

  function getInitials(name: string): string {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const loadData = useCallback(async () => {
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/client/login");
        return;
      }

      const { data: client } = await supabase
        .from("clients")
        .select("id, company_name, subscription_tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!client) {
        router.push("/client/login");
        return;
      }

      setClientId(client.id);
      setCompanyName(client.company_name || "Client");
      setSubscriptionTier(client.subscription_tier || "Basic");
      setInitials(getInitials(client.company_name || "Client"));

      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, job_title, venue_name, venue_city, venue_postcode, start_date, end_date, start_time, end_time, hourly_rate, number_of_guards, status, sia_licence_required, latitude, longitude, required_licence_types, required_license_type")
        .eq("id", jobId)
        .eq("client_id", client.id)
        .maybeSingle();

      if (!jobData) {
        router.push("/client/jobs");
        return;
      }

      setJob(jobData);

      const { data: applications } = await supabase
        .from("job_applications")
        .select("guard_id, status, cover_message, applied_at, shortlisted")
        .eq("job_id", jobId);

      const { data: allVerifiedGuards } = await supabase
        .from("guards")
        .select("id, user_id, full_name, email, phone, profile_image_url, rating, total_reviews, total_jobs_completed, hourly_rate, years_experience, sia_verified, sia_expiry_date, sia_licence_number, licence_types, specializations, location, postcode, bio, has_transport, availability_status, languages, home_latitude, home_longitude, sia_licence_front_url, sia_licence_back_url, profile_completed, verification_status, certifications, sia_verified_at")
        .in('verification_status', ['approved', 'verified'])
        .eq("is_active", true)
        .order("rating", { ascending: false });

      const { data: existingAssignments } = await supabase
        .from("job_assignments")
        .select("id, guard_id, status")
        .eq("job_id", jobId);

      const assignmentMap: Record<string, Assignment> = {};
      (existingAssignments || []).forEach((a) => {
        assignmentMap[a.guard_id] = a;
      });
      setAssignments(assignmentMap);

      const selectedSet = new Set<string>();
      const shortlistedSet = new Set<string>();
      const statusMap: Record<string, ApplicationStatus> = {};

      (applications || []).forEach((app) => {
        statusMap[app.guard_id] = {
          shortlisted: app.shortlisted || false,
          status: app.status || "pending",
          cover_message: app.cover_message || null,
          applied_at: app.applied_at || null,
        };
        if (app.shortlisted) shortlistedSet.add(app.guard_id);
      });

      Object.keys(assignmentMap).forEach((gid) => {
        selectedSet.add(gid);
      });

      setApplicantStatuses(statusMap);
      setSelectedGuardIds(selectedSet);
      setShortlistedIds(shortlistedSet);

      if (allVerifiedGuards) {
        const enrichedGuards: Guard[] = allVerifiedGuards.map((g) => {
          const app = statusMap[g.id];
          let dist: number | null = null;
          if (jobData.latitude && jobData.longitude && g.home_latitude && g.home_longitude) {
            dist = haversine(jobData.latitude, jobData.longitude, g.home_latitude, g.home_longitude);
          }
          return {
            ...g,
            cover_message: app?.cover_message || null,
            applied_at: app?.applied_at || null,
            distance_km: dist,
          };
        });

        setAllGuards(enrichedGuards);
      }
    } catch (error) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!job?.id) return;

    const channel = supabase
      .channel(`select-guards-${job.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "app", table: "job_applications", filter: `job_id=eq.${job.id}` },
        () => {
          showRealtimeToast("New guard applied to this job!", "info");
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "app", table: "job_applications", filter: `job_id=eq.${job.id}` },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.id, loadData]);

  const toggleSelect = (guardId: string) => {
    setSelectedGuardIds((prev) => {
      const next = new Set(prev);
      if (next.has(guardId)) {
        next.delete(guardId);
      } else {
        if (job && next.size >= job.number_of_guards) return prev;
        next.add(guardId);
      }
      return next;
    });
  };

  const toggleShortlist = async (guardId: string) => {
    const current = shortlistedIds.has(guardId);
    const newShortlisted = !current;

    setShortlistedIds((prev) => {
      const next = new Set(prev);
      if (next.has(guardId)) next.delete(guardId);
      else next.add(guardId);
      return next;
    });

    setApplicantStatuses((prev) => ({
      ...prev,
      [guardId]: {
        ...(prev[guardId] || { status: "pending", cover_message: null, applied_at: null }),
        shortlisted: newShortlisted,
      },
    }));

    try {
      await supabase
        .from("job_applications")
        .update({ shortlisted: newShortlisted, updated_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("guard_id", guardId);
    } catch (e) {
      console.error("Failed to update shortlist:", e);
    }
  };

  const rejectGuard = async (guardId: string) => {
    setApplicantStatuses((prev) => ({
      ...prev,
      [guardId]: {
        ...(prev[guardId] || { shortlisted: false, cover_message: null, applied_at: null }),
        status: "declined",
      },
    }));

    try {
      await supabase
        .from("job_applications")
        .update({ status: "declined", reviewed_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("guard_id", guardId);
      setToast("Guard declined");
      setTimeout(() => setToast(""), 3000);
    } catch (e) {
      console.error("Failed to decline guard:", e);
    }
  };

  const handleMessage = async (guardId: string, guardUserId: string, message: string, jobId?: string) => {
    setSendingMessage(true);
    try {
      const guard = allGuards.find((g) => g.id === guardId);
      if (!guard || !guardUserId) {
        setToast("Cannot message this guard");
        setTimeout(() => setToast(""), 3000);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetJobId = jobId || null;
      if (targetJobId) {
        const perm = await canSendJobMessage({
          currentUserId: user.id,
          currentUserType: 'client',
          jobId: targetJobId,
          otherUserId: guardUserId,
          otherUserType: 'guard',
        });
        if (!perm.allowed) {
          setToast(perm.error || 'You do not have permission to message this guard.');
          setTimeout(() => setToast(""), 3000);
          return;
        }
      }

      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        sender_type: "client",
        receiver_id: guardUserId,
        receiver_type: "guard",
        message_text: message,
        job_id: targetJobId,
        read: false,
      });

      if (error) throw error;

      try {
        await supabase.from('notifications').insert({
          user_id: guardUserId,
          user_type: 'guard',
          type: 'message',
          title: 'New message',
          message: `New message from client${job?.job_title ? ` for "${job.job_title}"` : ''}`,
          link: '/guard/messages',
          is_read: false,
        });
      } catch (notifyErr) {
        console.error('Failed to create notification:', notifyErr);
      }

      setToast("Message sent!");
      setTimeout(() => setToast(""), 3000);
      setMessageGuard(null);
    } catch (e) {
      console.error("Failed to send message:", e);
      setToast("Failed to send message");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBulkShortlist = async () => {
    setBulkProcessing(true);
    const ids = Array.from(checkedIds);
    for (const gid of ids) {
      await supabase
        .from("job_applications")
        .update({ shortlisted: true, updated_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("guard_id", gid);
    }
    setShortlistedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setApplicantStatuses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { ...(next[id] || { status: "pending", cover_message: null, applied_at: null }), shortlisted: true };
      });
      return next;
    });
    setCheckedIds(new Set());
    setBulkProcessing(false);
    setToast(`${ids.length} guard${ids.length !== 1 ? "s" : ""} shortlisted`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleBulkReject = async () => {
    setBulkProcessing(true);
    const ids = Array.from(checkedIds);
    for (const gid of ids) {
      await supabase
        .from("job_applications")
        .update({ status: "declined", reviewed_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("guard_id", gid);
    }
    setApplicantStatuses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { ...(next[id] || { shortlisted: false, cover_message: null, applied_at: null }), status: "declined" };
      });
      return next;
    });
    setCheckedIds(new Set());
    setBulkProcessing(false);
    setToast(`${ids.length} guard${ids.length !== 1 ? "s" : ""} rejected`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleBulkSelect = async () => {
    setBulkProcessing(true);
    const ids = Array.from(checkedIds);
    const available = job ? job.number_of_guards - selectedGuardIds.size : 0;
    const toSelect = ids.slice(0, Math.max(0, available));
    for (const gid of toSelect) {
      setSelectedGuardIds((prev) => {
        const next = new Set(prev);
        next.add(gid);
        return next;
      });
    }
    setCheckedIds(new Set());
    setBulkProcessing(false);
    setToast(`${toSelect.length} guard${toSelect.length !== 1 ? "s" : ""} selected`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleBulkMessage = async () => {
    setBulkProcessing(true);
    const ids = Array.from(checkedIds);
    let count = 0;
    for (const gid of ids) {
      const guard = allGuards.find(g => g.id === gid);
      if (!guard?.user_id) continue;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) continue;

        const perm = await canSendJobMessage({
          currentUserId: user.id,
          currentUserType: 'client',
          jobId: jobId,
          otherUserId: guard.user_id,
          otherUserType: 'guard',
        });
        if (!perm.allowed) continue;

        await supabase.from("messages").insert({
          sender_id: user.id,
          sender_type: "client",
          receiver_id: guard.user_id,
          receiver_type: "guard",
          message_text: "You have been shortlisted for our job. We will be in touch soon with next steps.",
          job_id: jobId,
          read: false,
        });
        try {
          await supabase.from("notifications").insert({
            user_id: guard.user_id,
            user_type: 'guard',
            type: 'message',
            title: 'New message',
            message: `New message from client${job?.job_title ? ` for "${job.job_title}"` : ''}`,
            link: '/guard/messages',
            is_read: false,
          });
        } catch (notifyErr) {
          console.error('Failed to create notification:', notifyErr);
        }
        count++;
      } catch {
        // skip
      }
    }
    setBulkProcessing(false);
    setCheckedIds(new Set());
    setToast(`${count} message${count !== 1 ? "s" : ""} sent`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleBulkInvite = async () => {
    setBulkProcessing(true);
    const ids = Array.from(checkedIds);
    let count = 0;
    for (const gid of ids) {
      const guard = allGuards.find(g => g.id === gid);
      if (!guard || guard.applied_at) continue;
      try {
        // TODO: backend invite endpoint — safe to skip if not available
        count++;
      } catch {
        // skip
      }
    }
    setBulkProcessing(false);
    setCheckedIds(new Set());
    setToast(`${count} invite${count !== 1 ? "s" : ""} sent`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleBulkExport = () => {
    const selectedGuards = allGuards.filter(g => checkedIds.has(g.id));
    if (selectedGuards.length === 0) {
      setToast("No guards selected");
      return;
    }
    const headers = [
      "Guard ID", "Name", "Rating", "Reviews", "Experience", "Hourly Rate",
      "SIA Verified", "Licence Number", "Licence Types", "Location", "Postcode",
      "Distance km", "Availability", "Applied At", "Status"
    ];
    const rows = selectedGuards.map(g => {
      const status = applicantStatuses?.[g.id];
      return [
        g.id, g.full_name, g.rating || "", g.total_reviews || 0,
        g.years_experience || 0, g.hourly_rate || "",
        g.sia_verified ? "Yes" : "No", g.sia_licence_number || "",
        (g.licence_types || []).join(";"), g.location || "", g.postcode || "",
        g.distance_km !== null ? g.distance_km.toFixed(1) : "",
        g.availability_status || "", g.applied_at || "",
        status?.status || ""
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, "\"\"")}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quickguard-applicants-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast(`${selectedGuards.length} applicant${selectedGuards.length !== 1 ? "s" : ""} exported`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleGuardBulkAction = (actionKey: string) => {
    if (actionKey === "shortlist") handleBulkShortlist();
    else if (actionKey === "reject") handleBulkReject();
    else if (actionKey === "select") handleBulkSelect();
    else if (actionKey === "message") handleBulkMessage();
    else if (actionKey === "invite") handleBulkInvite();
    else if (actionKey === "export") handleBulkExport();
  };

  const handleConfirm = async () => {
    if (!job) return;
    setConfirming(true);
    try {
      const selectedArray = Array.from(selectedGuardIds);
      const start = new Date(`${job.start_date}T${job.start_time}`);
      const end = new Date(`${job.end_date || job.start_date}T${job.end_time}`);
      let hoursPerGuard = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (hoursPerGuard <= 0) hoursPerGuard += 24;
      const startD = new Date(job.start_date);
      const endD = new Date(job.end_date || job.start_date);
      const days = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const agreedHours = hoursPerGuard * days;

      const assignmentsData = selectedArray.map((guardId) => {
        const guard = allGuards.find((g) => g.id === guardId);
        const guardHourlyRate = guard?.hourly_rate || job.hourly_rate;
        const grossGuardAmount = guardHourlyRate * agreedHours;
        return {
          job_id: job.id,
          guard_id: guardId,
          status: "pending",
          assigned_at: new Date().toISOString(),
          agreed_hourly_rate: guardHourlyRate,
          agreed_hours: agreedHours,
          gross_guard_amount: grossGuardAmount,
          currency: 'GBP',
        };
      });

      const { error: assignError } = await supabase.from("job_assignments").upsert(
        assignmentsData,
        { onConflict: 'job_id,guard_id', ignoreDuplicates: false }
      );
      if (assignError) throw assignError;

      for (const guardId of selectedArray) {
        await supabase
          .from("job_applications")
          .update({ status: "accepted", reviewed_at: new Date().toISOString() })
          .eq("job_id", job.id)
          .eq("guard_id", guardId);
      }

      const declinedGuardIds = allGuards
        .filter((g) => !selectedGuardIds.has(g.id) && g.applied_at)
        .map((g) => g.id);

      if (declinedGuardIds.length > 0) {
        for (const guardId of declinedGuardIds) {
          await supabase
            .from("job_applications")
            .update({ status: "declined", reviewed_at: new Date().toISOString() })
            .eq("job_id", job.id)
            .eq("guard_id", guardId);
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        for (const guardId of declinedGuardIds) {
          const guard = allGuards.find((g) => g.id === guardId);
          if (!guard) continue;
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-application-status-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                guard_id: guardId,
                guard_email: guard.email || '',
                guard_name: guard.full_name || '',
                guard_user_id: guard.user_id || '',
                job_id: job.id,
                job_title: job.job_title,
                client_name: companyName,
                status: 'declined',
                job_date: job.start_date,
                job_time: `${job.start_time} - ${job.end_time}`,
                location: job.venue_city,
                hourly_rate: job.hourly_rate,
              }),
            });
          } catch (emailErr) {
            console.error('Failed to send rejection email to guard', guardId, emailErr);
          }
        }
      }

      await supabase
        .from("jobs")
        .update({ status: "awaiting_payment", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      for (const guardId of selectedArray) {
        const guard = allGuards.find((g) => g.id === guardId);
        if (!guard) continue;

        try {
          if (guard.user_id) {
            await supabase.from('notifications').insert({
              user_id: guard.user_id,
              user_type: 'guard',
              type: 'job_selected',
              title: "You've Been Selected!",
              message: `A client has selected you for "${job.job_title}" at ${job.venue_city}. Confirm payment to lock in your shift.`,
              link: `/guard/dashboard`,
              is_read: false,
            });

            await sendPushToUser(guard.user_id, "guard", {
              title: "You've Been Selected!",
              body: `Client selected you for "${job.job_title}" at ${job.venue_city}. Complete payment to confirm.`,
              url: "/guard/dashboard",
              tag: "quickguard-selected",
            });
          }
        } catch (e) {
          console.error("Failed to send selection notification:", e);
        }
      }

      setShowConfirmModal(false);
      setSuccessMessage(`${selectedGuardIds.size} guard${selectedGuardIds.size > 1 ? "s" : ""} successfully assigned!`);

      setTimeout(() => {
        router.push(`/client/jobs/${job.id}/payment`);
      }, 2000);
    } catch (error) {
      console.error("Error confirming guards:", error);
      setToast("Failed to assign guards. Please try again.");
      setTimeout(() => setToast(""), 4000);
    } finally {
      setConfirming(false);
    }
  };

  const toggleCompare = (guardId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(guardId)) {
        next.delete(guardId);
      } else {
        if (next.size >= 5) {
          setToast("You can compare up to 5 guards at a time");
          setTimeout(() => setToast(""), 3000);
          return prev;
        }
        next.add(guardId);
      }
      return next;
    });
  };

  const compareGuards = allGuards.filter((g) => compareIds.has(g.id));

  const displayGuards = showAllGuards ? allGuards : allGuards.filter(
    (g) => g.applied_at !== null || shortlistedIds.has(g.id) || selectedGuardIds.has(g.id)
  );

  const filteredGuards = displayGuards.filter((g) => {
    const guardData: GuardComplianceData = {
      id: g.id,
      full_name: g.full_name,
      sia_verified: g.sia_verified,
      sia_expiry_date: g.sia_expiry_date,
      sia_licence_number: g.sia_licence_number,
      licence_types: g.licence_types,
      sia_licence_front_url: g.sia_licence_front_url || null,
      sia_licence_back_url: g.sia_licence_back_url || null,
      profile_completed: g.profile_completed || null,
      verification_status: g.verification_status || null,
      certifications: g.certifications || null,
      sia_verified_at: g.sia_verified_at || null,
    };
    const compliance = computeComplianceInfo(guardData, getJobLicenceTypes(job));

    if (job?.sia_licence_required && !g.sia_verified) return false;
    if (filters.siaLicence === "verified" && !g.sia_verified) return false;
    if (filters.siaLicence && filters.siaLicence !== "verified" && filters.siaLicence !== "") {
      const hasLicence = g.licence_types?.some((l) => l.toLowerCase().includes(filters.siaLicence.toLowerCase()));
      if (!hasLicence) return false;
    }
    if (filters.compliance === "fully_compliant" && !compliance.isFullyCompliant) return false;
    if (filters.compliance === "sia_verified" && !g.sia_verified) return false;
    if (filters.compliance === "expiring_soon" && compliance.siaStatus !== "expiring_soon") return false;
    if (filters.compliance === "missing_docs" && compliance.siaStatus !== "missing" && compliance.siaStatus !== "pending") return false;
    if (filters.compliance === "licence_match" && compliance.licenceMatchStatus !== "matched") return false;
    if (filters.compliance === "needs_review" && !compliance.needsAttention) return false;
    if (filters.distance && g.distance_km !== null && g.distance_km > parseFloat(filters.distance)) return false;
    if (filters.rating && (g.rating || 0) < parseFloat(filters.rating)) return false;
    if (filters.experience && (g.years_experience || 0) < parseFloat(filters.experience)) return false;
    if (filters.availability && g.availability_status !== filters.availability) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        g.full_name.toLowerCase().includes(q) ||
        (g.location && g.location.toLowerCase().includes(q)) ||
        (g.postcode && g.postcode.toLowerCase().includes(q)) ||
        (g.licence_types && g.licence_types.some((l) => l.toLowerCase().includes(q)))
      );
    }
    return true;
  }).sort((a, b) => {
    if (filters.sortBy === "compliance" || sortBy === "compliance") {
      const getScore = (g: Guard) => {
        const guardData: GuardComplianceData = {
          id: g.id,
          full_name: g.full_name,
          sia_verified: g.sia_verified,
          sia_expiry_date: g.sia_expiry_date,
          sia_licence_number: g.sia_licence_number,
          licence_types: g.licence_types,
          sia_licence_front_url: g.sia_licence_front_url || null,
          sia_licence_back_url: g.sia_licence_back_url || null,
          profile_completed: g.profile_completed || null,
          verification_status: g.verification_status || null,
          certifications: g.certifications || null,
          sia_verified_at: g.sia_verified_at || null,
        };
        return computeComplianceInfo(guardData, getJobLicenceTypes(job)).overallScore;
      };
      return getScore(b) - getScore(a);
    }
    if (filters.sortBy === "rating" || sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    if (filters.sortBy === "experience" || sortBy === "experience") return (b.years_experience || 0) - (a.years_experience || 0);
    if (filters.sortBy === "rate_low" || sortBy === "rate_low") return (a.hourly_rate || 0) - (b.hourly_rate || 0);
    if (filters.sortBy === "rate_high" || sortBy === "rate_high") return (b.hourly_rate || 0) - (a.hourly_rate || 0);
    if (filters.sortBy === "distance" || sortBy === "distance") return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
    if (filters.sortBy === "newest" || sortBy === "newest") return new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime();
    return 0;
  });

  const handleFilterChange = (key: string, value: string) => {
    if (key === "siaLicence" || key === "distance" || key === "rating" || key === "experience" || key === "availability" || key === "compliance") {
      setFilters((prev) => ({ ...prev, [key]: value === "all" ? "" : value }));
    }
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery("");
    setShowFilters(false);
  };

  const selectedGuards = allGuards.filter((g) => selectedGuardIds.has(g.id));

  const warnings: Warning[] = [];
  if (job) {
    if (selectedGuards.length < job.number_of_guards) {
      warnings.push({
        type: "understaffed",
        message: `You have selected ${selectedGuards.length} of ${job.number_of_guards} required guards.`,
      });
    }
    if (selectedGuards.length > job.number_of_guards) {
      warnings.push({
        type: "overstaffed",
        message: `You have selected ${selectedGuards.length} guards but only ${job.number_of_guards} are required.`,
      });
    }
    for (const g of selectedGuards) {
      if (g.sia_expiry_date) {
        const now = new Date();
        const expiry = new Date(g.sia_expiry_date);
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days < 0) {
          warnings.push({
            type: "expired_sia",
            message: `${g.full_name}'s SIA licence has expired.`,
            guardName: g.full_name,
          });
        } else if (days <= 30) {
          warnings.push({
            type: "near_expiry_sia",
            message: `${g.full_name}'s SIA licence expires in ${days} day${days !== 1 ? "s" : ""}.`,
            guardName: g.full_name,
          });
        }
      }
    }
  }

  const applicantCount = allGuards.filter((g) => g.applied_at).length;
  const shortlistedCount = shortlistedIds.size;

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading applicants...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm p-10 md:p-16 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <i className="ri-error-warning-line text-4xl text-red-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Failed to load applicants</h3>
            <p className="text-slate-500 text-sm mb-6">We could not load the applicant data for this job. Please try again.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={loadData} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                <i className="ri-refresh-line"></i>Retry
              </button>
              <Link href="/client/jobs" className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                <i className="ri-arrow-left-line"></i>Back to Jobs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <UpgradePrompt feature="client.advanced_matching" />
        </div>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="bg-[#111d35] rounded-2xl shadow-lg p-10 text-center max-w-md border border-[#1e2d4d]">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/25">
            <i className="ri-check-double-line text-4xl text-emerald-400"></i>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{successMessage}</h2>
          <p className="text-slate-400 mb-6">Redirecting to payment page...</p>
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName || "Client"}
        subtitle={subscriptionTier || "Free"}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <RealtimeToast />

        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#111d35] border border-[#1e2d4d] rounded-xl px-4 py-3 shadow-lg flex items-center gap-2">
            <i className="ri-information-line text-teal-400"></i>
            <span className="text-sm text-slate-300">{toast}</span>
            <button onClick={() => setToast("")} className="ml-2 w-5 h-5 flex items-center justify-center text-slate-500 cursor-pointer">
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 py-6 w-full">
          <ApplicantDashboardHeader
            job={job}
            applicantCount={applicantCount}
            selectedCount={selectedGuards.length}
            shortlistedCount={shortlistedCount}
          />

          <div className="mt-4">
            <ContextualHelpCard
              title="How to choose the right guard"
              tip="Look for SIA-verified badges, high ratings, and experience relevant to your venue type. You can compare up to 5 guards side by side, message them before selecting, and shortlist candidates for later review."
              learnMoreHref="/client/help#selecting-guards"
              learnMoreLabel="Selection guide"
              icon="ri-user-search-line"
              variant="compact"
            />
          </div>

          <div className="mt-6">
            <WarningBanner warnings={warnings} />
          </div>

          <div className="mt-6">
            <ComplianceWarnings
              complianceList={selectedGuards.map((g) => {
                const guardData: GuardComplianceData = {
                  id: g.id,
                  full_name: g.full_name,
                  sia_verified: g.sia_verified,
                  sia_expiry_date: g.sia_expiry_date,
                  sia_licence_number: g.sia_licence_number,
                  licence_types: g.licence_types,
                  sia_licence_front_url: g.sia_licence_front_url || null,
                  sia_licence_back_url: g.sia_licence_back_url || null,
                  profile_completed: g.profile_completed || null,
                  verification_status: g.verification_status || null,
                  certifications: g.certifications || null,
                  sia_verified_at: g.sia_verified_at || null,
                };
                return computeComplianceInfo(guardData, getJobLicenceTypes(job));
              })}
              guardNames={selectedGuards.map((g) => g.full_name)}
              guardsRequired={job?.number_of_guards || 0}
              guardsSelected={selectedGuards.length}
              requiredLicenceTypes={getJobLicenceTypes(job)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="lg:hidden">
                <JobCompliancePanel
                  guardsRequired={job?.number_of_guards || 0}
                  guardsSelected={selectedGuards.length}
                  compliantCount={selectedGuards.filter((g) => {
                    const guardData: GuardComplianceData = {
                      id: g.id,
                      full_name: g.full_name,
                      sia_verified: g.sia_verified,
                      sia_expiry_date: g.sia_expiry_date,
                      sia_licence_number: g.sia_licence_number,
                      licence_types: g.licence_types,
                      sia_licence_front_url: g.sia_licence_front_url || null,
                      sia_licence_back_url: g.sia_licence_back_url || null,
                      profile_completed: g.profile_completed || null,
                      verification_status: g.verification_status || null,
                      certifications: g.certifications || null,
                      sia_verified_at: g.sia_verified_at || null,
                    };
                    const comp = computeComplianceInfo(guardData, getJobLicenceTypes(job));
                    return comp.isFullyCompliant;
                  }).length}
                  needsReviewCount={selectedGuards.filter((g) => {
                    const guardData: GuardComplianceData = {
                      id: g.id,
                      full_name: g.full_name,
                      sia_verified: g.sia_verified,
                      sia_expiry_date: g.sia_expiry_date,
                      sia_licence_number: g.sia_licence_number,
                      licence_types: g.licence_types,
                      sia_licence_front_url: g.sia_licence_front_url || null,
                      sia_licence_back_url: g.sia_licence_back_url || null,
                      profile_completed: g.profile_completed || null,
                      verification_status: g.verification_status || null,
                      certifications: g.certifications || null,
                      sia_verified_at: g.sia_verified_at || null,
                    };
                    const comp = computeComplianceInfo(guardData, getJobLicenceTypes(job));
                    return comp.needsAttention;
                  }).length}
                  requiredLicenceTypes={getJobLicenceTypes(job)}
                  selectedGuardsCompliance={selectedGuards.map((g) => {
                    const guardData: GuardComplianceData = {
                      id: g.id,
                      full_name: g.full_name,
                      sia_verified: g.sia_verified,
                      sia_expiry_date: g.sia_expiry_date,
                      sia_licence_number: g.sia_licence_number,
                      licence_types: g.licence_types,
                      sia_licence_front_url: g.sia_licence_front_url || null,
                      sia_licence_back_url: g.sia_licence_back_url || null,
                      profile_completed: g.profile_completed || null,
                      verification_status: g.verification_status || null,
                      certifications: g.certifications || null,
                      sia_verified_at: g.sia_verified_at || null,
                    };
                    return computeComplianceInfo(guardData, getJobLicenceTypes(job));
                  })}
                />
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                  <SearchFilterBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="Search guards by name, location, postcode, or licence..."
                    filters={{
                      siaLicence: filters.siaLicence,
                      compliance: filters.compliance,
                      distance: filters.distance,
                      rating: filters.rating,
                      experience: filters.experience,
                      availability: filters.availability,
                    }}
                    onFilterChange={handleFilterChange}
                    filterConfigs={GUARD_FILTER_CONFIGS}
                    sortBy={sortBy}
                    onSortChange={(val) => {
                      setSortBy(val);
                      setFilters((prev) => ({ ...prev, sortBy: val || "rating" }));
                    }}
                    sortOptions={GUARD_SORT_OPTIONS}
                    resultCount={filteredGuards.length}
                    loading={loading}
                    onClear={handleClearFilters}
                    showMobilePanel={showFilters}
                    onToggleMobilePanel={() => setShowFilters((v) => !v)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-[#162036] rounded-lg p-1 border border-[#1e2d4d]">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`w-9 h-9 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                        viewMode === "grid" ? "bg-[#111d35] shadow-sm text-teal-400" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <i className="ri-grid-line text-lg"></i>
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`w-9 h-9 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                        viewMode === "list" ? "bg-[#111d35] shadow-sm text-teal-400" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <i className="ri-list-unordered text-lg"></i>
                    </button>
                  </div>
                </div>
              </div>

              <BulkActionBar
                selectedCount={checkedIds.size}
                totalCount={filteredGuards.length}
                allSelected={checkedIds.size === filteredGuards.length && filteredGuards.length > 0}
                onSelectAll={() => {
                  const ids = filteredGuards.map(g => g.id);
                  setCheckedIds(new Set(ids));
                }}
                onClearSelection={() => setCheckedIds(new Set())}
                actions={[
                  {
                    key: 'shortlist',
                    label: 'Shortlist',
                    icon: 'ri-bookmark-line',
                    variant: 'primary',
                  },
                  {
                    key: 'select',
                    label: 'Select',
                    icon: 'ri-check-line',
                    variant: 'primary',
                  },
                  {
                    key: 'message',
                    label: 'Message',
                    icon: 'ri-message-3-line',
                    variant: 'secondary',
                  },
                  {
                    key: 'invite',
                    label: 'Invite',
                    icon: 'ri-send-plane-line',
                    variant: 'secondary',
                  },
                  {
                    key: 'export',
                    label: 'Export',
                    icon: 'ri-download-line',
                    variant: 'secondary',
                  },
                  {
                    key: 'reject',
                    label: 'Reject',
                    icon: 'ri-close-circle-line',
                    variant: 'danger',
                    requiresConfirmation: true,
                    confirmationTitle: 'Reject Selected Applicants',
                    confirmationMessage: 'These guards will be marked as rejected for this job. They will be notified. This cannot be undone easily.',
                    confirmButtonText: 'Reject',
                    confirmButtonIcon: 'ri-close-circle-line',
                  },
                ]}
                onAction={handleGuardBulkAction}
                processing={bulkProcessing}
              />

              {!showAllGuards && applicantCount > 0 && (
                <div className="bg-teal-500/10 border border-teal-500/25 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-500/15 rounded-full flex items-center justify-center">
                        <i className="ri-user-star-line text-teal-400 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-teal-400">
                          {applicantCount} guard{applicantCount !== 1 ? "s" : ""} applied to this job
                        </p>
                        <p className="text-xs text-teal-500">Browse all verified guards to find more candidates</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAllGuards(true)}
                      className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-search-line mr-1.5"></i>
                      Browse All Guards
                    </button>
                  </div>
                </div>
              )}

              {showAllGuards && (
                <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-500/15 rounded-full flex items-center justify-center">
                        <i className="ri-team-line text-violet-400 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-violet-400">
                          Showing all verified guards ({filteredGuards.length} total)
                        </p>
                        <p className="text-xs text-violet-500">Guards who applied are shown first</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAllGuards(false)}
                      className="bg-[#162036] text-violet-400 border border-violet-500/25 px-4 py-2 rounded-lg hover:bg-violet-500/10 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-arrow-left-line mr-1.5"></i>
                      Show Applicants Only
                    </button>
                  </div>
                </div>
              )}

              {filteredGuards.length === 0 ? (
                <div className="bg-[#111d35] rounded-xl shadow-sm border border-[#1e2d4d] p-12 text-center">
                  <div className="w-20 h-20 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#1e2d4d]">
                    <i className="ri-user-search-line text-4xl text-slate-500"></i>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-200 mb-2">
                    {applicantCount === 0 && !showAllGuards
                      ? "No applicants yet"
                      : "No guards match your filters"}
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {applicantCount === 0 && !showAllGuards
                      ? "Guards will appear here once they apply for this job."
                      : "Try adjusting your search or filter criteria."}
                  </p>
                  {applicantCount === 0 && !showAllGuards && (
                    <button
                      onClick={() => setShowAllGuards(true)}
                      className="bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors font-medium cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-search-line mr-2"></i>
                      Browse All Verified Guards
                    </button>
                  )}
                </div>
              ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "space-y-4"}>
                  {filteredGuards.map((guard) => (
                    <ApplicantCard
                      key={guard.id}
                      guard={guard}
                      applicationStatus={applicantStatuses[guard.id]}
                      assignmentStatus={assignments[guard.id]?.status}
                      isSelected={selectedGuardIds.has(guard.id)}
                      isShortlisted={shortlistedIds.has(guard.id)}
                      isChecked={checkedIds.has(guard.id)}
                      isCompared={compareIds.has(guard.id)}
                      onToggleSelect={() => toggleSelect(guard.id)}
                      onToggleShortlist={() => toggleShortlist(guard.id)}
                      onToggleCheck={() => {
                        setCheckedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(guard.id)) next.delete(guard.id);
                          else next.add(guard.id);
                          return next;
                        });
                      }}
                      onToggleCompare={() => toggleCompare(guard.id)}
                      onViewProfile={() => setProfileGuard(guard)}
                      onMessage={() => setMessageGuard(guard)}
                      onReject={() => rejectGuard(guard.id)}
                      requiredLicenceTypes={getJobLicenceTypes(job)}
                      guardsRequired={job.number_of_guards}
                      guardsSelected={selectedGuards.length}
                      onInvite={() => setToast('Invite sent to ' + guard.full_name)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="hidden lg:block">
                <JobCompliancePanel
                  guardsRequired={job?.number_of_guards || 0}
                  guardsSelected={selectedGuards.length}
                  compliantCount={selectedGuards.filter((g) => {
                    const guardData: GuardComplianceData = {
                      id: g.id,
                      full_name: g.full_name,
                      sia_verified: g.sia_verified,
                      sia_expiry_date: g.sia_expiry_date,
                      sia_licence_number: g.sia_licence_number,
                      licence_types: g.licence_types,
                      sia_licence_front_url: g.sia_licence_front_url || null,
                      sia_licence_back_url: g.sia_licence_back_url || null,
                      profile_completed: g.profile_completed || null,
                      verification_status: g.verification_status || null,
                      certifications: g.certifications || null,
                      sia_verified_at: g.sia_verified_at || null,
                    };
                    const comp = computeComplianceInfo(guardData, getJobLicenceTypes(job));
                    return comp.isFullyCompliant;
                  }).length}
                  needsReviewCount={selectedGuards.filter((g) => {
                    const guardData: GuardComplianceData = {
                      id: g.id,
                      full_name: g.full_name,
                      sia_verified: g.sia_verified,
                      sia_expiry_date: g.sia_expiry_date,
                      sia_licence_number: g.sia_licence_number,
                      licence_types: g.licence_types,
                      sia_licence_front_url: g.sia_licence_front_url || null,
                      sia_licence_back_url: g.sia_licence_back_url || null,
                      profile_completed: g.profile_completed || null,
                      verification_status: g.verification_status || null,
                      certifications: g.certifications || null,
                      sia_verified_at: g.sia_verified_at || null,
                    };
                    const comp = computeComplianceInfo(guardData, getJobLicenceTypes(job));
                    return comp.needsAttention;
                  }).length}
                  requiredLicenceTypes={getJobLicenceTypes(job)}
                  selectedGuardsCompliance={selectedGuards.map((g) => {
                    const guardData: GuardComplianceData = {
                      id: g.id,
                      full_name: g.full_name,
                      sia_verified: g.sia_verified,
                      sia_expiry_date: g.sia_expiry_date,
                      sia_licence_number: g.sia_licence_number,
                      licence_types: g.licence_types,
                      sia_licence_front_url: g.sia_licence_front_url || null,
                      sia_licence_back_url: g.sia_licence_back_url || null,
                      profile_completed: g.profile_completed || null,
                      verification_status: g.verification_status || null,
                      certifications: g.certifications || null,
                      sia_verified_at: g.sia_verified_at || null,
                    };
                    return computeComplianceInfo(guardData, getJobLicenceTypes(job));
                  })}
                />
              </div>
              <div className="hidden lg:block">
                <SelectedGuardsPanel
                  guards={selectedGuards.map((g) => ({
                    id: g.id,
                    full_name: g.full_name,
                    profile_image_url: g.profile_image_url,
                    hourly_rate: g.hourly_rate,
                    rating: g.rating,
                    sia_verified: g.sia_verified,
                    confirmation_status: assignments[g.id]?.status || "pending",
                  }))}
                  guardsRequired={job.number_of_guards}
                  onRemove={(id) => toggleSelect(id)}
                  onContact={(id) => {
                    const g = allGuards.find((gg) => gg.id === id);
                    if (g) setMessageGuard(g);
                  }}
                  onProceedToPayment={() => setShowConfirmModal(true)}
                />
              </div>
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  <i className="ri-lightbulb-line mr-1.5 text-amber-400"></i>
                  Tips
                </h3>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5"></i>
                    <span>Select guards that match your SIA licence requirements.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5"></i>
                    <span>Check SIA expiry dates before confirming.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5"></i>
                    <span>Shortlist multiple guards to compare later.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5"></i>
                    <span>Message guards to confirm availability.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5"></i>
                    <span>Use the compare button to review guards side-by-side.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CompareSelectionBar
        count={compareIds.size}
        onCompare={() => setShowCompareModal(true)}
        onClear={() => setCompareIds(new Set())}
      />

      {showCompareModal && (
        <CompareGuardsModal
          guards={compareGuards}
          onClose={() => setShowCompareModal(false)}
          onRemove={(id) => toggleCompare(id)}
          onSelect={(id) => toggleSelect(id)}
          onMessage={(guard) => setMessageGuard(guard)}
          onViewProfile={(guard) => setProfileGuard(guard)}
          selectedGuardIds={selectedGuardIds}
        />
      )}

      {profileGuard && (
        <GuardProfileModal
          guard={profileGuard}
          isSelected={selectedGuardIds.has(profileGuard.id)}
          isShortlisted={shortlistedIds.has(profileGuard.id)}
          onClose={() => setProfileGuard(null)}
          onToggleSelect={() => {
            toggleSelect(profileGuard.id);
            setProfileGuard(null);
          }}
          onToggleShortlist={() => {
            toggleShortlist(profileGuard.id);
          }}
          onMessage={() => setMessageGuard(profileGuard)}
          guardsRequired={job.number_of_guards}
          guardsSelected={selectedGuards.length}
          requiredLicenceTypes={getJobLicenceTypes(job)}
        />
      )}

      {showConfirmModal && (
        <ConfirmSelectionModal
          selectedGuards={selectedGuards}
          job={job}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirm}
          confirming={confirming}
          isUnderstaffed={selectedGuards.length < job.number_of_guards}
          isOverstaffed={selectedGuards.length > job.number_of_guards}
        />
      )}

      {messageGuard && (
        <MessageGuardModal
          guardName={messageGuard.full_name}
          guardId={messageGuard.id}
          guardUserId={messageGuard.user_id || ''}
          jobId={jobId}
          onClose={() => setMessageGuard(null)}
          onSend={(msg, guardUserId, jobId) => handleMessage(messageGuard.id, guardUserId, msg, jobId)}
          sending={sendingMessage}
        />
      )}
    </div>
  );
}