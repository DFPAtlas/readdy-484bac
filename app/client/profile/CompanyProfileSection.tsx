"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface CompanyProfile {
  id: string;
  company_name: string;
  company_type: string;
  vat_number: string;
  trading_name: string;
  company_registration_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_email: string;
  website: string;
  industry: string;
  company_size: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_postcode: string;
  description: string;
}

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  id: string;
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
}

function Section({ title, icon, children, id, activeSection, setActiveSection }: SectionProps) {
  const open = activeSection === id || activeSection === null;
  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setActiveSection(open ? id : null)}
        className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer lg:pointer-events-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center">
            <i className={`${icon} text-teal-500 text-lg`}></i>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>
        <i className={`ri-arrow-down-s-line text-slate-400 lg:hidden transition-transform ${open ? "rotate-180" : ""}`}></i>
      </button>
      <div className={`${open ? "block" : "hidden lg:block"} px-6 pb-6`}>{children}</div>
    </div>
  );
}

interface Props {
  profile: CompanyProfile;
  onUpdate: (updated: CompanyProfile) => void;
  onError: (msg: string) => void;
}

export default function CompanyProfileSection({ profile, onUpdate, onError }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CompanyProfile>({
    ...profile,
    website: profile.website
      ? (profile.website.match(/^https?:\/\//) ? profile.website : `https://${profile.website}`)
      : "https://"
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sameAsMainContact, setSameAsMainContact] = useState(
    profile.billing_email === profile.email || !profile.billing_email
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleToggleSameContact = () => {
    const newValue = !sameAsMainContact;
    setSameAsMainContact(newValue);
    if (newValue) {
      setForm((f) => ({ ...f, billing_email: f.email }));
    } else {
      setForm((f) => ({ ...f, billing_email: "" }));
    }
  };

  const handleCopyAddress = () => {
    setForm((f) => ({
      ...f,
      billing_address_line1: f.address_line1,
      billing_address_line2: f.address_line2,
      billing_city: f.city,
      billing_postcode: f.postcode,
    }));
  };

  const hasCompanyAddress = Boolean(form.address_line1 || form.city || form.postcode);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("clients")
      .update({
        company_name: form.company_name,
        company_type: form.company_type,
        vat_number: form.vat_number,
        trading_name: form.trading_name,
        company_registration_number: form.company_registration_number,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        billing_email: form.billing_email,
        website: form.website && form.website !== "https://" ? form.website : "",
        industry: form.industry,
        company_size: form.company_size,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        postcode: form.postcode,
        billing_address_line1: form.billing_address_line1,
        billing_address_line2: form.billing_address_line2,
        billing_city: form.billing_city,
        billing_postcode: form.billing_postcode,
        description: form.description,
      })
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      onError("Failed to update profile. Please try again.");
      return;
    }
    onUpdate(form);
  };

  return (
    <form onSubmit={handleSave}>
      <Section title="Company Details" icon="ri-building-line" id="company-details" activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="Your Company Ltd"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Website
            </label>
            <input
              type="url"
              name="website"
              value={form.website || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="https://www.yourcompany.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Trading Name
            </label>
            <input
              type="text"
              name="trading_name"
              value={form.trading_name || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="Trading as..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Company Registration Number
            </label>
            <input
              type="text"
              name="company_registration_number"
              value={form.company_registration_number || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="e.g. 12345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Company Size <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              name="company_size"
              value={form.company_size || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white pr-8"
            >
              <option value="">Select Size</option>
              <option value="1-10">1-10 employees</option>
              <option value="11-50">11-50 employees</option>
              <option value="51-200">51-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Industry
            </label>
            <select
              name="industry"
              value={form.industry || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white pr-8"
            >
              <option value="">Select Industry</option>
              <option value="Events & Entertainment">Events & Entertainment</option>
              <option value="Retail">Retail</option>
              <option value="Hospitality">Hospitality</option>
              <option value="Corporate">Corporate</option>
              <option value="Construction">Construction</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              VAT Number
            </label>
            <input
              type="text"
              name="vat_number"
              value={form.vat_number || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="GB123456789"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Company Description
            </label>
            <textarea
              name="description"
              value={form.description || ""}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="Tell us about your company..."
            />
          </div>
        </div>
      </Section>

      <Section title="Main Contact" icon="ri-user-line" id="main-contact" activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg bg-slate-100 dark:bg-[#162036] text-slate-500 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed here</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="+44 7XXX XXXXXX"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Billing Email
            </label>
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={handleToggleSameContact}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${sameAsMainContact ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sameAsMainContact ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Same as main contact email
              </span>
            </div>
            <input
              type="email"
              name="billing_email"
              value={form.billing_email || ""}
              onChange={handleChange}
              disabled={sameAsMainContact}
              className={`w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm ${sameAsMainContact ? 'bg-slate-100 dark:bg-[#0f1a2e] text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-[#162036] text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'}`}
              placeholder="finance@yourcompany.com"
            />
          </div>
        </div>
      </Section>

      <Section title="Company Address" icon="ri-map-pin-line" id="company-address" activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Address Line 1
            </label>
            <input
              type="text"
              name="address_line1"
              value={form.address_line1 || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="123 Business Street"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Address Line 2
            </label>
            <input
              type="text"
              name="address_line2"
              value={form.address_line2 || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="Suite 100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              City
            </label>
            <input
              type="text"
              name="city"
              value={form.city || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="London"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Postcode
            </label>
            <input
              type="text"
              name="postcode"
              value={form.postcode || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="SW1A 1AA"
            />
          </div>
        </div>
      </Section>

      <Section title="Billing Address" icon="ri-receipt-line" id="billing-address" activeSection={activeSection} setActiveSection={setActiveSection}>
        <div className="mb-4">
          <button
            type="button"
            onClick={handleCopyAddress}
            disabled={!hasCompanyAddress}
            className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <i className="ri-file-copy-line w-4 h-4 flex items-center justify-center"></i>
            Copy from Company Address
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Billing Address Line 1
            </label>
            <input
              type="text"
              name="billing_address_line1"
              value={form.billing_address_line1 || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="123 Business Street"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Billing Address Line 2
            </label>
            <input
              type="text"
              name="billing_address_line2"
              value={form.billing_address_line2 || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="Suite 100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              City
            </label>
            <input
              type="text"
              name="billing_city"
              value={form.billing_city || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="London"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Postcode
            </label>
            <input
              type="text"
              name="billing_postcode"
              value={form.billing_postcode || ""}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-[#1e2d4d] rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-white dark:bg-[#162036] text-slate-900 dark:text-white"
              placeholder="SW1A 1AA"
            />
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 lg:static lg:mt-4 z-20">
        <button
          type="submit"
          disabled={saving}
          className="w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg lg:shadow-none whitespace-nowrap cursor-pointer"
        >
          {saving ? (
            <>
              <i className="ri-loader-4-line animate-spin w-5 h-5 flex items-center justify-center"></i>
              Saving...
            </>
          ) : (
            <>
              <i className="ri-save-line w-5 h-5 flex items-center justify-center"></i>
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}