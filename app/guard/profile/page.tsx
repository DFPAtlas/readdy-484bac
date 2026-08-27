'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import PortalSidebar from '@/components/PortalSidebar';
import SIALicenceImage from '@/components/SIALicenceImage';
import ImageCropper from '@/components/ImageCropper';
import { uploadSIALicence, uploadProfilePhoto, getProfilePhotoUrl } from '@/lib/supabase-storage';
import { geocodePostcode } from '@/lib/geocoding';

function ProfileContent() {
  const searchParams = useSearchParams();
  const guardId = searchParams.get('id');
  const isAdminView = searchParams.get('admin') === 'true';
  const { loading: authLoading, allowed } = useGuardGuard();

  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('Guard');
  const [initials, setInitials] = useState('G');
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);

  const [siaFrontFile, setSiaFrontFile] = useState<File | null>(null);
  const [siaBackFile, setSiaBackFile] = useState<File | null>(null);
  const [siaFrontPreview, setSiaFrontPreview] = useState<string>('');
  const [siaBackPreview, setSiaBackPreview] = useState<string>('');
  const [siaUploadError, setSiaUploadError] = useState('');
  const [uploadingSia, setUploadingSia] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<any>();
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!allowed && !isAdminView) return;

    async function loadProfile() {
      if (cancelled) return;
      setLoading(true);
      try {
        let targetId = guardId;
        if (!targetId && !isAdminView) {
          const { data: { user } } = await supabase.auth.getUser();
          if (cancelled) return;
          if (!user) { if (!cancelled) setLoading(false); return; }
          setAuthUserId(user.id);
          const { data: guard } = await supabase.from('guards').select('id').eq('user_id', user.id).maybeSingle();
          if (cancelled) return;
          targetId = guard?.id;
        }
        if (!targetId) { if (!cancelled) setLoading(false); return; }

        const { data } = await supabase
          .from('guards')
          .select(`
            id, full_name, email, phone, date_of_birth, postcode,
            sia_licence_number, sia_expiry_date, licence_types, years_experience,
            profile_image_url, bio, availability,
            verification_status, verified_at, created_at,
            promo_tier, signup_number, lifetime_fee_percentage,
            sia_licence_front_url, sia_licence_back_url,
            max_distance_miles, willing_to_travel
          `)
          .eq('id', targetId)
          .maybeSingle();

        if (cancelled) return;

        if (data) {
          setProfile(data);
          setForm({ ...data });
          setDisplayName(data.full_name || 'Guard');
          setInitials((data.full_name || 'Guard').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase());

          if (!cancelled) {
            getProfilePhotoUrl(data.profile_image_url).then(setResolvedPhotoUrl);
          }
        }
      } catch {
      }
      if (!cancelled) setLoading(false);
    }

    loadProfile();

    return () => { cancelled = true; };
  }, [authLoading, allowed, guardId, isAdminView]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setUpdating(true);
    setSaveStatus('idle');
    try {
      let frontUrl = form.sia_licence_front_url;
      let backUrl = form.sia_licence_back_url;

      if (siaFrontFile) {
        if (!authUserId) throw new Error('User not authenticated');
        frontUrl = await uploadSIALicence(siaFrontFile, authUserId, 'front');
      }
      if (siaBackFile) {
        if (!authUserId) throw new Error('User not authenticated');
        backUrl = await uploadSIALicence(siaBackFile, authUserId, 'back');
      }

      const licenceTypeValue = form.licence_types
        ? (Array.isArray(form.licence_types) ? form.licence_types : [form.licence_types])
        : [];

      const updatePayload: Record<string, any> = {
        full_name: form.full_name,
        phone: form.phone,
        date_of_birth: form.date_of_birth,
        postcode: form.postcode,
        sia_licence_number: form.sia_licence_number,
        sia_expiry_date: form.sia_expiry_date,
        licence_types: licenceTypeValue,
        years_experience: form.years_experience,
        bio: form.bio,
        max_distance_miles: form.max_distance_miles !== undefined ? form.max_distance_miles : null,
        willing_to_travel: form.willing_to_travel,
        sia_licence_front_url: frontUrl,
        sia_licence_back_url: backUrl,
        sia_licence_uploaded_at: siaFrontFile ? new Date().toISOString() : form.sia_licence_uploaded_at,
        updated_at: new Date().toISOString(),
      };

      const postcodeValue = (form.postcode || '').trim();
      if (postcodeValue) {
        try {
          const geo = await geocodePostcode(postcodeValue);
          if (geo?.latitude && geo?.longitude) {
            updatePayload.home_latitude = geo.latitude;
            updatePayload.home_longitude = geo.longitude;
          }
        } catch {
          // geocoding is best-effort; never block profile save on it
        }
      }

      const { error } = await supabase
        .from('guards')
        .update(updatePayload)
        .eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, ...form, sia_licence_front_url: frontUrl, sia_licence_back_url: backUrl });
      setSiaFrontFile(null);
      setSiaBackFile(null);
      setSiaFrontPreview('');
      setSiaBackPreview('');
      setIsEditing(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleCroppedImage = async (croppedFile: File) => {
    setCropFile(null);
    if (!profile?.id) return;
    setUploadingImage(true);
    try {
      if (!authUserId) throw new Error('User not authenticated');

      const publicUrl = await uploadProfilePhoto(croppedFile, authUserId);

      await supabase.from('guards').update({ profile_image_url: publicUrl }).eq('id', profile.id);
      setProfile((prev: any) => ({ ...prev, profile_image_url: publicUrl }));
      setResolvedPhotoUrl(publicUrl);
    } catch {
      setErrorMessage('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!allowed && !isAdminView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="text-center">
          <i className="ri-lock-line text-4xl text-slate-500 mb-4"></i>
          <p className="text-slate-400">Please sign in to view your profile</p>
          <Link href="/guard/login" className="text-teal-400 hover:underline mt-4 inline-block">Sign In</Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <p className="text-slate-400">Profile not found</p>
      </div>
    );
  }

  const tabs = [
    { key: 'personal', label: 'Personal', icon: 'ri-user-line' },
    { key: 'licence', label: 'Licence', icon: 'ri-shield-check-line' },
    { key: 'work', label: 'Work', icon: 'ri-briefcase-line' },
    { key: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      {!isAdminView && (
        <PortalSidebar role="guard" displayName={displayName} subtitle={profile.verification_status || 'Pending'} initials={initials} />
      )}
      <div className={`flex-1 min-h-screen ${!isAdminView ? 'ml-72' : ''}`}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6 mb-6">
            <div className="flex items-start gap-6">
              <div className="relative">
                {resolvedPhotoUrl ? (
                  <img src={resolvedPhotoUrl} alt="" className="w-24 h-24 rounded-2xl object-cover object-top border border-[#1e2d4d]" />
                ) : profile.profile_image_url ? (
                  <img src={profile.profile_image_url} alt="" className="w-24 h-24 rounded-2xl object-cover object-top border border-[#1e2d4d]" />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-teal-500 flex items-center justify-center text-white text-2xl font-bold border border-[#1e2d4d]">
                    {initials}
                  </div>
                )}
                {isEditing && (
                  <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-teal-400 transition-colors">
                    <i className="ri-camera-line text-white text-sm"></i>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCropFile(file);
                      e.target.value = '';
                    }} disabled={uploadingImage} />
                  </label>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{profile.full_name || 'Guard Profile'}</h1>
                <p className="text-slate-400 text-sm mt-1">{profile.email}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    profile.verification_status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                      : profile.verification_status === 'rejected'
                      ? 'bg-red-500/15 text-red-400 border-red-500/25'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                  }`}>
                    {profile.verification_status === 'approved' && <i className="ri-checkbox-circle-fill"></i>}
                    {profile.verification_status === 'rejected' && <i className="ri-close-circle-fill"></i>}
                    {profile.verification_status === 'pending' && <i className="ri-time-line"></i>}
                    {profile.verification_status?.charAt(0).toUpperCase() + profile.verification_status?.slice(1)}
                  </span>
                  {profile.promo_tier && profile.promo_tier !== 'standard' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-teal-500/15 text-teal-400 border-teal-500/25">
                      <i className="ri-vip-crown-line"></i>
                      {profile.promo_tier?.charAt(0).toUpperCase() + profile.promo_tier?.slice(1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => { setIsEditing(false); setForm({ ...profile }); }} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-[#1e2d4d] hover:bg-[#162036] cursor-pointer whitespace-nowrap">
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={updating} className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-500 text-white hover:bg-teal-400 disabled:opacity-50 cursor-pointer whitespace-nowrap">
                      {updating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-[#162036] text-slate-300 hover:text-white border border-[#1e2d4d] hover:bg-[#1a2642] cursor-pointer whitespace-nowrap flex items-center gap-2">
                    <i className="ri-edit-line"></i> Edit Profile
                  </button>
                )}
              </div>
            </div>
          </div>

          {saveStatus === 'success' && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-center gap-3 mb-6">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-xl"></i>
              <span className="text-emerald-400 text-sm font-medium">Profile updated successfully</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 flex items-center gap-3 mb-6">
              <i className="ri-error-warning-fill text-red-400 text-xl"></i>
              <span className="text-red-400 text-sm font-medium">{errorMessage || 'Update failed'}</span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#111d35] rounded-xl p-1 border border-[#1e2d4d] mb-6 w-fit">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  activeTab === t.key ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <i className={t.icon}></i> {t.label}
              </button>
            ))}
          </div>

          <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6">
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                    {isEditing ? (
                      <input type="text" name="full_name" value={form.full_name || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.full_name || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                    <p className="text-white text-sm">{profile.email || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Phone</label>
                    {isEditing ? (
                      <input type="tel" name="phone" value={form.phone || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.phone || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Date of Birth</label>
                    {isEditing ? (
                      <input type="date" name="date_of_birth" value={form.date_of_birth || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-GB') : '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Postcode</label>
                    {isEditing ? (
                      <input type="text" name="postcode" value={form.postcode || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.postcode || '—'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'licence' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white mb-4">SIA Licence Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">SIA Licence Number</label>
                    {isEditing ? (
                      <input type="text" name="sia_licence_number" value={form.sia_licence_number || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.sia_licence_number || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">SIA Expiry Date</label>
                    {isEditing ? (
                      <input type="date" name="sia_expiry_date" value={form.sia_expiry_date || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.sia_expiry_date ? new Date(profile.sia_expiry_date).toLocaleDateString('en-GB') : '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Licence Types</label>
                    {isEditing ? (
                      <div className="relative">
                        <select
                          name="licence_types"
                          value={Array.isArray(form.licence_types) ? form.licence_types[0] || '' : form.licence_types || ''}
                          onChange={(e) => setForm((prev: any) => ({ ...prev, licence_types: e.target.value ? [e.target.value] : [] }))}
                          className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm appearance-none pr-8"
                        >
                          <option value="">Select type</option>
                          <option value="Door Supervisor">Door Supervisor</option>
                          <option value="Security Guard">Security Guard</option>
                          <option value="CCTV Operator">CCTV Operator</option>
                          <option value="Close Protection">Close Protection</option>
                          <option value="Cash & Valuables in Transit">Cash & Valuables in Transit</option>
                          <option value="Key Holding">Key Holding</option>
                          <option value="Dog Handler">Dog Handler</option>
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                      </div>
                    ) : (
                      <p className="text-white text-sm">{Array.isArray(profile.licence_types) && profile.licence_types.length > 0 ? profile.licence_types.join(', ') : '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Years of Experience</label>
                    {isEditing ? (
                      <input type="number" name="years_experience" value={form.years_experience || ''} onChange={handleChange} min="0" className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500" />
                    ) : (
                      <p className="text-white text-sm">{profile.years_experience != null ? `${profile.years_experience} years` : '—'}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1e2d4d]">
                  <label className="block text-sm font-semibold text-white mb-4">SIA Licence Images</label>
                  {siaUploadError && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex items-center gap-2 mb-4">
                      <i className="ri-error-warning-line text-red-400 text-sm"></i>
                      <span className="text-red-400 text-sm">{siaUploadError}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-slate-400 mb-2">Front of Licence</p>
                      {isEditing ? (
                        <div className="space-y-3">
                          {siaFrontPreview ? (
                            <div className="bg-[#0B1933] rounded-xl overflow-hidden border border-[#1e2d4d]">
                              <img src={siaFrontPreview} alt="Front preview" className="w-full h-auto max-h-[200px] object-contain" />
                            </div>
                          ) : profile.sia_licence_front_url ? (
                            <SIALicenceImage path={profile.sia_licence_front_url} label="Front of Licence" className="border border-[#1e2d4d] rounded-xl" />
                          ) : (
                            <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                              <p className="text-sm text-slate-500">No front image uploaded</p>
                            </div>
                          )}
                          <label className="inline-flex items-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap">
                            <i className="ri-upload-2-line"></i>
                            {siaFrontPreview || profile.sia_licence_front_url ? 'Replace' : 'Upload Front'}
                            <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 10 * 1024 * 1024) {
                                setSiaUploadError('File size must be less than 10MB');
                                return;
                              }
                              setSiaUploadError('');
                              setSiaFrontFile(file);
                              setSiaFrontPreview(URL.createObjectURL(file));
                            }} />
                          </label>
                        </div>
                      ) : (
                        profile.sia_licence_front_url ? (
                          <SIALicenceImage path={profile.sia_licence_front_url} label="Front of Licence" className="border border-[#1e2d4d] rounded-xl" />
                        ) : (
                          <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                            <p className="text-sm text-slate-500">No front image uploaded</p>
                          </div>
                        )
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400 mb-2">Back of Licence</p>
                      {isEditing ? (
                        <div className="space-y-3">
                          {siaBackPreview ? (
                            <div className="bg-[#0B1933] rounded-xl overflow-hidden border border-[#1e2d4d]">
                              <img src={siaBackPreview} alt="Back preview" className="w-full h-auto max-h-[200px] object-contain" />
                            </div>
                          ) : profile.sia_licence_back_url ? (
                            <SIALicenceImage path={profile.sia_licence_back_url} label="Back of Licence" className="border border-[#1e2d4d] rounded-xl" />
                          ) : (
                            <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                              <p className="text-sm text-slate-500">No back image uploaded</p>
                            </div>
                          )}
                          <label className="inline-flex items-center gap-2 px-3 py-2 bg-teal-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-400 cursor-pointer whitespace-nowrap">
                            <i className="ri-upload-2-line"></i>
                            {siaBackPreview || profile.sia_licence_back_url ? 'Replace' : 'Upload Back'}
                            <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 10 * 1024 * 1024) {
                                setSiaUploadError('File size must be less than 10MB');
                                return;
                              }
                              setSiaUploadError('');
                              setSiaBackFile(file);
                              setSiaBackPreview(URL.createObjectURL(file));
                            }} />
                          </label>
                        </div>
                      ) : (
                        profile.sia_licence_back_url ? (
                          <SIALicenceImage path={profile.sia_licence_back_url} label="Back of Licence" className="border border-[#1e2d4d] rounded-xl" />
                        ) : (
                          <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                            <p className="text-sm text-slate-500">No back image uploaded</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'work' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white mb-4">Work Profile</h2>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Bio</label>
                  {isEditing ? (
                    <textarea name="bio" value={form.bio || ''} onChange={handleChange} rows={4} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 resize-none" />
                  ) : (
                    <p className="text-white text-sm whitespace-pre-wrap">{profile.bio || 'No bio added yet.'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Availability</label>
                  {isEditing ? (
                    <div className="relative">
                      <select name="availability" value={form.availability || ''} onChange={handleChange} className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm appearance-none pr-8">
                        <option value="">Select availability</option>
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                        <option value="weekends">Weekends only</option>
                        <option value="evenings">Evenings only</option>
                        <option value="nights">Nights only</option>
                        <option value="flexible">Flexible</option>
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                    </div>
                  ) : (
                    <p className="text-white text-sm capitalize">{typeof profile.availability === 'string' ? profile.availability : '—'}</p>
                  )}
                </div>

                <div className="pt-4 border-t border-[#1e2d4d]">
                  <h3 className="text-base font-semibold text-white mb-1">Travel Preferences</h3>
                  <p className="text-xs text-slate-500 mb-5">Set how far you are willing to travel for jobs. This helps match you with jobs in your preferred area.</p>

                  {isEditing ? (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                        <div>
                          <p className="text-sm font-medium text-white">Willing to travel</p>
                          <p className="text-xs text-slate-400 mt-0.5">Turn off if you only want jobs in your immediate area</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm((prev: any) => ({ ...prev, willing_to_travel: !prev.willing_to_travel }))}
                          className={`relative w-12 h-7 rounded-full transition-colors duration-200 cursor-pointer ${
                            form.willing_to_travel !== false ? 'bg-teal-500' : 'bg-[#0B1933] border border-[#1e2d4d]'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                            form.willing_to_travel !== false ? 'left-[22px]' : 'left-0.5'
                          }`} />
                        </button>
                      </div>

                      {form.willing_to_travel !== false && (
                        <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-white">Maximum travel distance</label>
                            <span className="text-sm font-semibold text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg">
                              {form.max_distance_miles || 20} {form.max_distance_miles === 1 ? 'mile' : 'miles'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={form.max_distance_miles || 20}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, max_distance_miles: parseInt(e.target.value) }))}
                            className="w-full h-2 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, #14B8A6 0%, #14B8A6 ${((form.max_distance_miles || 20) - 1) / 99 * 100}%, #1e2d4d ${((form.max_distance_miles || 20) - 1) / 99 * 100}%, #1e2d4d 100%)`,
                              accentColor: '#14B8A6',
                            }}
                          />
                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-slate-500">1 mile</span>
                            <span className="text-xs text-slate-500">50 miles</span>
                            <span className="text-xs text-slate-500">100 miles</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {[5, 10, 15, 20, 30, 50].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setForm((prev: any) => ({ ...prev, max_distance_miles: m }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                  (form.max_distance_miles || 20) === m
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-[#0B1933] text-slate-400 hover:text-white border border-[#1e2d4d] hover:border-teal-500/50'
                                }`}
                              >
                                {m} mi
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                        <div className="flex items-center gap-2 mb-1">
                          <i className={`${profile.willing_to_travel !== false ? 'ri-road-map-line text-teal-400' : 'ri-map-pin-line text-slate-500'}`}></i>
                          <p className="text-sm font-medium text-slate-400">Travel Status</p>
                        </div>
                        <p className="text-white text-sm mt-1">
                          {profile.willing_to_travel !== false ? 'Open to travel' : 'Local jobs only'}
                        </p>
                      </div>
                      {profile.willing_to_travel !== false && (
                        <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                          <div className="flex items-center gap-2 mb-1">
                            <i className="ri-route-line text-teal-400"></i>
                            <p className="text-sm font-medium text-slate-400">Max Distance</p>
                          </div>
                          <p className="text-white text-sm mt-1">
                            {profile.max_distance_miles ? `${profile.max_distance_miles} miles` : 'Not set'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white mb-4">Account Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-sm font-medium text-slate-400">Member Since</p>
                    <p className="text-white text-sm mt-1">{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB') : '—'}</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-sm font-medium text-slate-400">Verified At</p>
                    <p className="text-white text-sm mt-1">{profile.verified_at ? new Date(profile.verified_at).toLocaleDateString('en-GB') : 'Pending verification'}</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-sm font-medium text-slate-400">Signup Number</p>
                    <p className="text-white text-sm mt-1">{profile.signup_number ? String(profile.signup_number).padStart(4, '0') : '—'}</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-sm font-medium text-slate-400">Lifetime Fee</p>
                    <p className="text-white text-sm mt-1">{profile.lifetime_fee_percentage != null ? `${profile.lifetime_fee_percentage}%` : 'Standard'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {cropFile && (
        <ImageCropper
          file={cropFile}
          aspect={1}
          onCrop={handleCroppedImage}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  );
}

export default function GuardProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}