"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import PortalSidebar from "@/components/PortalSidebar";
import { useClientGuard } from "@/hooks/useClientGuard";
import CompanyProfileSection from "./CompanyProfileSection";
import SiteContactsSection from "./SiteContactsSection";
import BillingSection from "./BillingSection";
import DocumentsSection from "./DocumentsSection";
import PreferencesSection from "./PreferencesSection";
import DataPrivacySection from "./DataPrivacySection";
import Link from "next/link";

interface ClientProfile {
  id: string;
  user_id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  industry: string;
  company_size: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  website: string;
  description: string;
  vat_number: string;
  billing_email: string;
  company_type: string;
  trading_name: string;
  company_registration_number: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_postcode: string;
  verified: boolean;
  verification_status: string;
  subscription_tier: string;
  subscription_status: string;
  stripe_customer_id: string;
  trial_end_date: string | null;
  current_period_end: string | null;
  plan_name: string;
  logo_url: string;
  total_jobs_posted: number;
  total_spent: number;
  created_at: string;
  client_promo_tier: string;
  client_promo_jobs_remaining: number;
  founding_client_badge: boolean;
  client_lifetime_fee_discount: number;
}

interface ClientContact {
  id: string;
  contact_type: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_default: boolean;
}

interface ClientDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  description: string;
  expiry_date: string;
  created_at: string;
}

interface NotificationPrefs {
  new_applicants: boolean;
  guard_confirmations: boolean;
  payment_updates: boolean;
  job_reminders: boolean;
  support_tickets: boolean;
  messages: boolean;
  in_app_alerts: boolean;
  sms_notifications: boolean;
  email_frequency: string;
}

interface SubscriptionInfo {
  plan_name: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end_date: string | null;
  billing_cycle: string | null;
  amount_paid: number;
  payment_status: string;
  stripe_subscription_id: string;
  next_payment_date: string | null;
}

const TABS = [
  { key: "company", label: "Company Profile", icon: "ri-building-line" },
  { key: "contacts", label: "Site Contacts", icon: "ri-contacts-line" },
  { key: "billing", label: "Billing & Plan", icon: "ri-bank-card-line" },
  { key: "documents", label: "Documents", icon: "ri-folder-3-line" },
  { key: "preferences", label: "Notifications & Security", icon: "ri-shield-user-line" },
  { key: "data", label: "Data & Privacy", icon: "ri-database-2-line" },
];

function ClientProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, allowed } = useClientGuard();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "company");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [healthData, setHealthData] = useState({
    profileComplete: false,
    billingAdded: false,
    firstJobPosted: false,
    paymentMethodAdded: false,
    notificationsSet: false,
    documentsUploaded: false,
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadAll = useCallback(async () => {
    setLoadError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/client/login");
        return;
      }

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!clientData) {
        router.push("/client/complete-profile-wizard");
        return;
      }

      const cid = clientData.id;
      setProfile(clientData as ClientProfile);

      const { data: contactsData } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", cid)
        .order("created_at", { ascending: true });
      setContacts(contactsData || []);

      const { data: docsData } = await supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", cid)
        .order("created_at", { ascending: false });
      setDocuments(docsData || []);

      const { data: prefsData } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (prefsData) {
        setNotifPrefs(prefsData as NotificationPrefs);
      } else {
        setNotifPrefs({
          new_applicants: true,
          guard_confirmations: true,
          payment_updates: true,
          job_reminders: true,
          support_tickets: true,
          messages: true,
          in_app_alerts: true,
          sms_notifications: false,
          email_frequency: "immediate",
        });
      }

      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setSubscription(subData as SubscriptionInfo || null);

      const { count: jobsCount } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("client_id", cid);

      const { count: txCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("client_id", cid);

      setHealthData({
        profileComplete: !!(clientData.company_name && clientData.phone && clientData.address_line1),
        billingAdded: !!(clientData.billing_email || clientData.vat_number || clientData.billing_address_line1),
        firstJobPosted: (jobsCount || 0) > 0,
        paymentMethodAdded: (txCount || 0) > 0 || !!clientData.stripe_customer_id,
        notificationsSet: !!prefsData,
        documentsUploaded: (docsData || []).length > 0,
      });

      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshContacts = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: true });
    setContacts(data || []);
  };

  const refreshDocuments = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false });
    setDocuments(data || []);
    setHealthData((h) => ({ ...h, documentsUploaded: (data || []).length > 0 }));
  };

  const refreshPrefs = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    if (data) {
      setNotifPrefs(data as NotificationPrefs);
      setHealthData((h) => ({ ...h, notificationsSet: true }));
    }
  };

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen pb-20 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20">
            <div className="mb-6 space-y-3">
              <div className="h-4 w-36 bg-[#162036] rounded animate-pulse" />
              <div className="h-8 sm:h-10 w-48 sm:w-56 bg-[#162036] rounded animate-pulse" />
              <div className="h-3 w-64 sm:w-80 bg-[#162036] rounded animate-pulse" />
            </div>
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
              <div className="lg:w-64 flex-shrink-0 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`h-10 sm:h-11 w-full rounded-xl animate-pulse ${i === 0 ? 'bg-teal-500/20' : 'bg-[#162036]'}`} />
                ))}
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-4 sm:p-6 space-y-4">
                  <div className="h-5 w-32 bg-[#162036] rounded animate-pulse" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-3 w-20 bg-[#162036] rounded animate-pulse" />
                        <div className="h-10 w-full bg-[#162036] rounded-lg animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-24 bg-[#162036] rounded animate-pulse" />
                    <div className="h-24 w-full bg-[#162036] rounded-lg animate-pulse" />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <div className="h-9 w-20 bg-[#162036] rounded-lg animate-pulse" />
                    <div className="h-9 w-24 bg-teal-500/20 rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen pb-20 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20">
            <div className="mb-6 space-y-3">
              <div className="h-4 w-36 bg-[#162036] rounded animate-pulse" />
              <div className="h-8 sm:h-10 w-48 sm:w-56 bg-[#162036] rounded animate-pulse" />
              <div className="h-3 w-64 sm:w-80 bg-[#162036] rounded animate-pulse" />
            </div>
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
              <div className="lg:w-64 flex-shrink-0 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`h-10 sm:h-11 w-full rounded-xl animate-pulse ${i === 0 ? 'bg-teal-500/20' : 'bg-[#162036]'}`} />
                ))}
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-4 sm:p-6 space-y-4">
                  <div className="h-5 w-32 bg-[#162036] rounded animate-pulse" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-3 w-20 bg-[#162036] rounded animate-pulse" />
                        <div className="h-10 w-full bg-[#162036] rounded-lg animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-24 bg-[#162036] rounded animate-pulse" />
                    <div className="h-24 w-full bg-[#162036] rounded-lg animate-pulse" />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <div className="h-9 w-20 bg-[#162036] rounded-lg animate-pulse" />
                    <div className="h-9 w-24 bg-teal-500/20 rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg p-8">
            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm p-10 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i className="ri-error-warning-line text-4xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load settings</h3>
              <p className="text-slate-500 text-sm mb-6">We could not load your account settings. Please try again.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={loadAll} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-refresh-line"></i>Retry
                </button>
                <Link href="/client/dashboard" className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-dashboard-line"></i>Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const initials = profile.company_name
    ? profile.company_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CL";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={profile.company_name || profile.first_name || "Client"}
        subtitle={profile.subscription_tier || "Free"}
        initials={initials}
      />
      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-20">
          <div className="mb-6">
            <button
              onClick={() => router.push("/client/dashboard")}
              className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium transition-colors mb-3 text-sm"
            >
              <i className="ri-arrow-left-line w-5 h-5 flex items-center justify-center"></i>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Account Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage your company profile, billing, contacts, and preferences
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <i
                  className={`${
                    message.type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"
                  } text-xl w-5 h-5 flex items-center justify-center`}
                ></i>
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-64 flex-shrink-0">
              <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-2 lg:sticky lg:top-8">
                {TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? "bg-teal-500 text-white shadow-md"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#162036]"
                      }`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${tab.icon} text-base`}></i>
                      </div>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {activeTab === "company" && (
                <CompanyProfileSection
                  profile={profile}
                  onUpdate={(updated) => {
                    setProfile(updated);
                    showMessage("success", "Company profile updated successfully");
                    setHealthData((h) => ({
                      ...h,
                      profileComplete: !!(updated.company_name && updated.phone && updated.address_line1),
                      billingAdded: !!(updated.billing_email || updated.vat_number || updated.billing_address_line1),
                    }));
                  }}
                  onError={(err) => showMessage("error", err)}
                />
              )}
              {activeTab === "contacts" && (
                <SiteContactsSection
                  clientId={profile.id}
                  contacts={contacts}
                  onRefresh={refreshContacts}
                  onMessage={(type, text) => showMessage(type, text)}
                />
              )}
              {activeTab === "billing" && (
                <BillingSection
                  subscription={subscription}
                  profile={profile}
                  onMessage={(type, text) => showMessage(type, text)}
                />
              )}
              {activeTab === "documents" && (
                <DocumentsSection
                  clientId={profile.id}
                  documents={documents}
                  onRefresh={refreshDocuments}
                  onMessage={(type, text) => showMessage(type, text)}
                />
              )}
              {activeTab === "preferences" && (
                <PreferencesSection
                  profile={profile}
                  notifPrefs={notifPrefs}
                  healthData={healthData}
                  onRefreshPrefs={refreshPrefs}
                  onMessage={(type, text) => showMessage(type, text)}
                />
              )}
              {activeTab === "data" && (
                <DataPrivacySection
                  profile={profile}
                  onMessage={(type, text) => showMessage(type, text)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
        </div>
      }
    >
      <ClientProfileInner />
    </Suspense>
  );
}