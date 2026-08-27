'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureEntitlement } from '@/lib/entitlements';
import { uploadProfilePhoto, uploadSIALicence, uploadDrivingLicence, uploadProofOfAddress } from '@/lib/supabase-storage';
import ProfileWizard from '@/components/ProfileWizard';
import WizardNavigation from '@/components/WizardNavigation';
import WizardCard from '@/components/WizardCard';
import RoleSwitchModal from '@/components/RoleSwitchModal';
import { useProfileWizardFields, useProfileFormData } from '@/components/DynamicProfileForm';
import SIALicenceUploader from '@/components/SIALicenceUploader';
import SIALicenceImage from '@/components/SIALicenceImage';
import GuardDocumentsUploader from '@/components/GuardDocumentsUploader';
import DocumentImage from '@/components/DocumentImage';
import { hasGuardWizardEditFlag, clearGuardWizardEditFlag, isDashboardAllowedStatus, setGuardWizardEditFlag } from '@/lib/guard-wizard-edit';

const WIZARD_STEPS = [
  { id: 1, title: 'Welcome', description: 'Get started', icon: 'ri-hand-heart-line' },
  { id: 2, title: 'Photo', description: 'Add your photo', icon: 'ri-camera-line' },
  { id: 3, title: 'SIA Licence', description: 'Upload your licence', icon: 'ri-shield-check-line' },
  { id: 4, title: 'Documents', description: 'Driving licence & POA', icon: 'ri-file-list-3-line' },
  { id: 5, title: 'Contact', description: 'How to reach you', icon: 'ri-phone-line' },
  { id: 6, title: 'Experience', description: 'Your background', icon: 'ri-shield-star-line' },
  { id: 7, title: 'Availability', description: 'When you work', icon: 'ri-calendar-check-line' },
  { id: 8, title: 'About You', description: 'Final details', icon: 'ri-file-text-line' }
];

const SECTION_MAP: Record<string, number> = {
  first_name: 5, last_name: 5, phone: 5,
  sia_licence_number: 3, license_cardholder_name: 3, sia_expiry_date: 3,
  years_experience: 6, hourly_rate: 6, certifications: 6,
  available_days: 7, available_hours_from: 7, available_hours_to: 7,
  bio: 8,
};

function getFieldStep(fieldKey: string): number {
  return SECTION_MAP[fieldKey] || 4;
}

function safeRedirect(url: string) {
  // no-op — use router.push instead to avoid breaking the iframe
}

function GuardCompleteProfileWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [oauthAvatarUrl, setOauthAvatarUrl] = useState<string | null>(null);

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [useOAuthPhoto, setUseOAuthPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [existingData, setExistingData] = useState<Record<string, any>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [originalSia, setOriginalSia] = useState<{ number: string; expiry: string; fullName: string }>({ number: '', expiry: '', fullName: '' });
  const [loadError, setLoadError] = useState('');
  const [roleSwitch, setRoleSwitch] = useState<'none' | 'client' | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { fields, loading: fieldsLoading, error: fieldsError } = useProfileWizardFields('guard_profile');
  const { formData, errors, setValue, toggleMultiValue, validate } = useProfileFormData(fields, existingData);

  const [siaLicenceFront, setSiaLicenceFront] = useState<File | null>(null);
  const [siaLicenceBack, setSiaLicenceBack] = useState<File | null>(null);
  const [siaFrontPreview, setSiaFrontPreview] = useState<string>('');
  const [siaBackPreview, setSiaBackPreview] = useState<string>('');
  const [uploadingSia, setUploadingSia] = useState(false);
  const [siaFileError, setSiaFileError] = useState('');
  const [siaFrontPath, setSiaFrontPath] = useState<string>('');
  const [siaBackPath, setSiaBackPath] = useState<string>('');

  const [drivingLicenceFront, setDrivingLicenceFront] = useState<File | null>(null);
  const [drivingLicenceBack, setDrivingLicenceBack] = useState<File | null>(null);
  const [drivingFrontPreview, setDrivingFrontPreview] = useState<string>('');
  const [drivingBackPreview, setDrivingBackPreview] = useState<string>('');
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [proofOfAddressPreview, setProofOfAddressPreview] = useState<string>('');
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docsFileError, setDocsFileError] = useState('');
  const [drivingFrontPath, setDrivingFrontPath] = useState<string>('');
  const [drivingBackPath, setDrivingBackPath] = useState<string>('');
  const [poaPath, setPoaPath] = useState<string>('');

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initWizard = async () => {
      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;
        setLoadError('Loading timed out. Please refresh the page.');
        setLoading(false);
      }, 5000);

      const { data: { session } } = await supabase.auth.getSession();
      if (!mountedRef.current) return;

      if (!session?.user) {
        if (timeoutId) clearTimeout(timeoutId);
        const urlHasEdit = typeof window !== 'undefined' && window.location.search.includes('edit=1');
        const editParam = searchParams.get('edit') === '1' || urlHasEdit;
        if (editParam) {
          setGuardWizardEditFlag();
          router.push('/guard/login?redirect=' + encodeURIComponent('/guard/complete-profile-wizard?edit=1'));
        } else {
          router.push('/guard/login');
        }
        return;
      }

      const user = session.user;
      const [{ data: guardData }, { data: clientData }] = await Promise.all([
        supabase.from('guards').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('clients').select('id').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!mountedRef.current) return;

      if (!guardData && clientData) {
        if (timeoutId) clearTimeout(timeoutId);
        setRoleSwitch('client');
        setLoading(false);
        return;
      }

      setRoleSwitch('none');
      await loadProfile(user);
      if (timeoutId && mountedRef.current) clearTimeout(timeoutId);
    };

    initWizard();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (!mountedRef.current) return;
      if (event === 'SIGNED_OUT') {
        router.push('/guard/login');
      }
    });

    unsubscribe = () => subscription.unsubscribe();
    return () => {
      mountedRef.current = false;
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const loadProfile = async (user: any) => {
    try {
      setUserId(user.id);
      setUserEmail(user.email || '');

      const provider = searchParams.get('provider') || user.app_metadata?.provider;
      const isOAuth = provider === 'google' || provider === 'apple' || !!user.app_metadata?.providers?.find((p: string) => p === 'google' || p === 'apple');
      setIsOAuthUser(isOAuth);
      setOauthProvider(provider || null);

      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const nameParts = fullName.split(' ');
      const firstName = user.user_metadata?.first_name || nameParts[0] || '';
      const lastName = user.user_metadata?.last_name || nameParts.slice(1).join(' ') || '';

      setUserName(firstName || user.email?.split('@')[0] || 'there');

      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      if (avatarUrl) {
        setOauthAvatarUrl(avatarUrl);
        setPhotoPreview(avatarUrl);
        setUseOAuthPhoto(true);
      }

      const { data: guardData, error: guardError } = await supabase
        .from('guards')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (guardError) {
        setLoadError('Failed to load your profile. Please refresh and try again.');
      }

      const isEditing = hasGuardWizardEditFlag(searchParams.get('edit'));

      if (guardData?.profile_completed && !isEditing) {
        const ent = await ensureEntitlement(user.id, 'guard');
        if (ent?.is_active) {
          if (isDashboardAllowedStatus(guardData.verification_status)) {
            router.push('/guard/dashboard');
          } else if (guardData.verification_status === 'rejected') {
            router.push('/guard/verification-failed');
          } else {
            router.push('/guard/onboarding');
          }
          return;
        }
      }

      if (guardData?.onboarding_status === 'awaiting_payment' && guardData?.profile_completed && !isEditing) {
        router.push('/guard/dashboard');
        return;
      }

      if (guardData) {
        if (isEditing) {
          clearGuardWizardEditFlag();
          setIsEditMode(true);
        }
        setOriginalStatus(guardData.verification_status || null);
        setOriginalSia({
          number: guardData.sia_licence_number || '',
          expiry: guardData.sia_expiry_date || '',
          fullName: guardData.full_name || '',
        });

        const existingFullName = guardData.full_name || '';
        const existingParts = existingFullName.split(' ');
        const initial: Record<string, any> = {};
        if (existingParts[0]) initial.first_name = existingParts[0];
        if (existingParts.slice(1).join(' ')) initial.last_name = existingParts.slice(1).join(' ');
        if (guardData.phone) initial.phone = guardData.phone;
        if (guardData.sia_licence_number) initial.sia_licence_number = guardData.sia_licence_number;
        if (guardData.license_cardholder_name) initial.license_cardholder_name = guardData.license_cardholder_name;
        if (guardData.sia_expiry_date) initial.sia_expiry_date = guardData.sia_expiry_date;
        if (guardData.years_experience) initial.years_experience = String(guardData.years_experience);
        if (guardData.hourly_rate) initial.hourly_rate = String(guardData.hourly_rate);
        if (guardData.certifications) initial.certifications = guardData.certifications;
        if (guardData.available_days) initial.available_days = guardData.available_days;
        if (guardData.available_hours_from) initial.available_hours_from = guardData.available_hours_from;
        if (guardData.available_hours_to) initial.available_hours_to = guardData.available_hours_to;
        if (guardData.bio) initial.bio = guardData.bio;
        if (guardData.profile_image_url) {
          setPhotoPreview(guardData.profile_image_url);
          setUseOAuthPhoto(false);
        }
        if (guardData.sia_licence_front_url) {
          setSiaFrontPath(guardData.sia_licence_front_url);
        }
        if (guardData.sia_licence_back_url) {
          setSiaBackPath(guardData.sia_licence_back_url);
        }
        if (guardData.driving_licence_front_url) {
          setDrivingFrontPath(guardData.driving_licence_front_url);
        }
        if (guardData.driving_licence_back_url) {
          setDrivingBackPath(guardData.driving_licence_back_url);
        }
        if (guardData.proof_of_address_url) {
          setPoaPath(guardData.proof_of_address_url);
        }
        setExistingData(initial);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setLoadError('An unexpected error occurred. Please refresh the page.');
    }

    if (mountedRef.current) setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    setProfilePhoto(file);
    setUseOAuthPhoto(false);
    const reader = new FileReader();
    reader.onloadend = () => { setPhotoPreview(reader.result as string); };
    reader.readAsDataURL(file);
    setError('');
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    setUseOAuthPhoto(false);
    setPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUseOAuthPhoto = () => {
    if (oauthAvatarUrl) {
      setProfilePhoto(null);
      setUseOAuthPhoto(true);
      setPhotoPreview(oauthAvatarUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getProviderIcon = () => {
    if (oauthProvider === 'google') return 'ri-google-fill';
    if (oauthProvider === 'apple') return 'ri-apple-fill';
    return 'ri-user-line';
  };

  const getProviderName = () => {
    if (oauthProvider === 'google') return 'Google';
    if (oauthProvider === 'apple') return 'Apple';
    return 'your account';
  };

  const fieldsForStep = (step: number) =>
    fields.filter((f) => f.is_enabled && getFieldStep(f.field_key) === step && f.field_key !== 'last_name');

  const validateStep = (step: number): boolean => {
    setError('');
    const stepFields = fieldsForStep(step);
    const newErrors: Record<string, string> = {};

    stepFields.forEach((field) => {
      if (!field.is_required) return;
      const val = formData[field.field_key];
      if (val === '' || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
        newErrors[field.field_key] = `${field.field_label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      setError(firstError);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 || currentStep === 2 || (currentStep === 3 && validateSIAStep()) || (currentStep === 4 && validateDocumentsStep()) || validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const validateSIAStep = (): boolean => {
    setSiaFileError('');
    const siaNumber = formData.sia_licence_number || '';
    const siaExpiry = formData.sia_expiry_date || '';
    if (!siaNumber.trim()) {
      setSiaFileError('SIA licence number is required');
      return false;
    }
    if (!siaExpiry) {
      setSiaFileError('SIA expiry date is required');
      return false;
    }
    if (!siaLicenceFront && !siaFrontPath) {
      setSiaFileError('Please upload the front of your SIA licence');
      return false;
    }
    if (!siaLicenceBack && !siaBackPath) {
      setSiaFileError('Please upload the back of your SIA licence');
      return false;
    }
    return true;
  };

  const validateDocumentsStep = (): boolean => {
    setDocsFileError('');
    if (!drivingLicenceFront && !drivingFrontPath) {
      setDocsFileError('Please upload the front of your driving licence');
      return false;
    }
    if (!drivingLicenceBack && !drivingBackPath) {
      setDocsFileError('Please upload the back of your driving licence');
      return false;
    }
    if (!proofOfAddress && !poaPath) {
      setDocsFileError('Please upload a proof of address document');
      return false;
    }
    return true;
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setError('Please fill in all required fields');
      return;
    }
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (password || confirmPassword) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setSaving(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSaving(false);
          return;
        }
      }

      let photoUrl: string | null = null;
      if (useOAuthPhoto && oauthAvatarUrl) {
        photoUrl = oauthAvatarUrl;
      } else if (profilePhoto) {
        setUploadingPhoto(true);
        try {
          photoUrl = await uploadProfilePhoto(profilePhoto, userId);
        } catch (uploadErr: any) {
          setUploadingPhoto(false);
          throw new Error(uploadErr.message || 'Failed to upload profile photo');
        }
        setUploadingPhoto(false);
      }

      const fullName = [formData.first_name, formData.last_name].filter(Boolean).join(' ');

      const updatePayload: Record<string, any> = {
        full_name: fullName || null,
        profile_completed: true,
        onboarding_status: 'completed',
        subscription_plan: 'guard_starter',
        subscription_status: 'active',
        availability_status: 'available',
        updated_at: new Date().toISOString()
      };

      const criticalChanged =
        (formData.sia_licence_number || '') !== originalSia.number ||
        (formData.sia_expiry_date || '') !== originalSia.expiry ||
        (fullName || '') !== originalSia.fullName ||
        !!siaLicenceFront || !!siaLicenceBack ||
        !!drivingLicenceFront || !!drivingLicenceBack || !!proofOfAddress;

      if (isEditMode) {
        const wasApproved = isDashboardAllowedStatus(originalStatus);
        if (!wasApproved) {
          updatePayload.verification_status = 'pending';
          updatePayload.is_active = false;
          updatePayload.dashboard_access = false;
          updatePayload.rejection_reason = null;
          updatePayload.rejected_at = null;
        } else if (criticalChanged) {
          updatePayload.verification_status = 'manual_review';
          updatePayload.is_active = false;
          updatePayload.dashboard_access = false;
          updatePayload.rejection_reason = null;
          updatePayload.rejected_at = null;
        }
      } else {
        updatePayload.is_active = false;
        updatePayload.dashboard_access = false;
      }

      if (photoUrl) updatePayload.profile_image_url = photoUrl;

      let finalFrontPath = siaFrontPath;
      let finalBackPath = siaBackPath;

      if (siaLicenceFront) {
        setUploadingSia(true);
        try {
          finalFrontPath = await uploadSIALicence(siaLicenceFront, userId, 'front');
          setSiaFrontPath(finalFrontPath);
        } catch (siaErr: any) {
          setUploadingSia(false);
          throw new Error(siaErr.message || 'Failed to upload SIA licence front image');
        }
        setUploadingSia(false);
      }

      if (siaLicenceBack) {
        setUploadingSia(true);
        try {
          finalBackPath = await uploadSIALicence(siaLicenceBack, userId, 'back');
          setSiaBackPath(finalBackPath);
        } catch (siaErr: any) {
          setUploadingSia(false);
          throw new Error(siaErr.message || 'Failed to upload SIA licence back image');
        }
        setUploadingSia(false);
      }

      if (finalFrontPath) {
        updatePayload.sia_licence_front_url = finalFrontPath;
        updatePayload.sia_licence_uploaded_at = new Date().toISOString();
      }
      if (finalBackPath) {
        updatePayload.sia_licence_back_url = finalBackPath;
      }

      let finalDrivingFrontPath = drivingFrontPath;
      let finalDrivingBackPath = drivingBackPath;
      let finalPoaPath = poaPath;

      if (drivingLicenceFront) {
        setUploadingDocs(true);
        try {
          finalDrivingFrontPath = await uploadDrivingLicence(drivingLicenceFront, userId, 'front');
          setDrivingFrontPath(finalDrivingFrontPath);
        } catch (docErr: any) {
          setUploadingDocs(false);
          throw new Error(docErr.message || 'Failed to upload driving licence front image');
        }
        setUploadingDocs(false);
      }

      if (drivingLicenceBack) {
        setUploadingDocs(true);
        try {
          finalDrivingBackPath = await uploadDrivingLicence(drivingLicenceBack, userId, 'back');
          setDrivingBackPath(finalDrivingBackPath);
        } catch (docErr: any) {
          setUploadingDocs(false);
          throw new Error(docErr.message || 'Failed to upload driving licence back image');
        }
        setUploadingDocs(false);
      }

      if (proofOfAddress) {
        setUploadingDocs(true);
        try {
          finalPoaPath = await uploadProofOfAddress(proofOfAddress, userId);
          setPoaPath(finalPoaPath);
        } catch (docErr: any) {
          setUploadingDocs(false);
          throw new Error(docErr.message || 'Failed to upload proof of address');
        }
        setUploadingDocs(false);
      }

      if (finalDrivingFrontPath) {
        updatePayload.driving_licence_front_url = finalDrivingFrontPath;
        updatePayload.driving_licence_uploaded_at = new Date().toISOString();
      }
      if (finalDrivingBackPath) {
        updatePayload.driving_licence_back_url = finalDrivingBackPath;
      }
      if (finalPoaPath) {
        updatePayload.proof_of_address_url = finalPoaPath;
        updatePayload.proof_of_address_uploaded_at = new Date().toISOString();
      }

      if (formData.phone) updatePayload.phone = formData.phone;
      if (formData.sia_licence_number) updatePayload.sia_licence_number = formData.sia_licence_number;
      if (formData.license_cardholder_name) updatePayload.license_cardholder_name = formData.license_cardholder_name;
      if (formData.sia_expiry_date) updatePayload.sia_expiry_date = formData.sia_expiry_date;
      if (formData.years_experience) updatePayload.years_experience = parseInt(formData.years_experience);
      if (formData.hourly_rate) updatePayload.hourly_rate = parseFloat(formData.hourly_rate);
      if (formData.certifications) updatePayload.certifications = formData.certifications;
      if (formData.available_days) updatePayload.available_days = formData.available_days;
      if (formData.available_hours_from) updatePayload.available_hours_from = formData.available_hours_from;
      if (formData.available_hours_to) updatePayload.available_hours_to = formData.available_hours_to;
      if (formData.bio) updatePayload.bio = formData.bio;

      const { error: updateError } = await supabase.from('guards').update(updatePayload).eq('user_id', userId);
      if (updateError) {
        throw new Error(updateError.message || 'Failed to update profile');
      }

      await ensureEntitlement(userId, 'guard');
      const { error: entActivateError } = await supabase
        .from('user_entitlements_data')
        .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (entActivateError) {
        console.error('[GuardProfileWizard] Entitlement activation failed:', entActivateError.message);
      }

      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password });
        if (pwdError) {
          setError('Profile saved, but password update failed: ' + pwdError.message);
          setSaving(false);
          return;
        }
      }

      const { data: guardAfterUpdate } = await supabase.from('guards').select('id, sia_licence_number').eq('user_id', userId).maybeSingle();
      if (guardAfterUpdate?.sia_licence_number) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sia-check`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              guard_id: guardAfterUpdate.id,
              sia_licence_number: guardAfterUpdate.sia_licence_number,
            }),
          }).catch((err) => console.error('[ProfileWizard] SIA check call failed:', err));
        }
      }

      router.push('/guard/onboarding');
    } catch (err: any) {
      const errorMessage = err?.message || (typeof err === 'string' ? err : 'Failed to save profile. Please try again.');
      setError(errorMessage);
      setSaving(false);
      setUploadingPhoto(false);
      setUploadingSia(false);
      setUploadingDocs(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading || fieldsLoading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (roleSwitch === 'client') {
    return <RoleSwitchModal targetRole="guard" />;
  }

  const displayError = error || loadError || fieldsError || '';

  const renderFieldInput = (field: any) => {
    const key = field.field_key;
    const value = formData?.[key];
    const err = errors?.[key];
    const multi = field.field_key === 'certifications' || field.field_key === 'available_days' ||
      (field.help_text && field.help_text.toLowerCase().includes('select all'));
    const options: string[] = Array.isArray(field.options) ? field.options : [];

    return (
      <div key={field.id} className="space-y-1.5">
        {field.field_type !== 'checkbox' && (
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            {field.field_label}
            {field.is_required && <span className="text-red-400 ml-1">*</span>}
            {field.help_text && !multi && (
              <span className="text-slate-500 font-normal ml-1">({field.help_text})</span>
            )}
          </label>
        )}

        {field.field_type === 'textarea' && (
          <textarea
            id={key}
            name={key}
            value={value || ''}
            onChange={(e) => setValue(key, e.target.value)}
            className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none resize-none min-h-[100px]"
            placeholder={field.placeholder || ''}
            maxLength={500}
          />
        )}

        {field.field_type === 'select' && multi && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {options.map((opt: string) => {
                const selected = (value || []).includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleMultiValue(key, opt)}
                    className={`px-3 py-3 rounded-xl border-2 text-xs font-medium transition-all text-center cursor-pointer ${
                      selected
                        ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                        : 'border-slate-700/50 bg-[#162236] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {selected && <i className="ri-check-line text-teal-400 mr-1"></i>}
                    {opt}
                  </button>
                );
              })}
            </div>
            {field.help_text && <p className="text-xs text-slate-500 mt-2">{field.help_text}</p>}
          </div>
        )}

        {field.field_type === 'select' && !multi && (
          <div className="relative">
            <select
              id={key}
              name={key}
              value={value || ''}
              onChange={(e) => setValue(key, e.target.value)}
              className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white outline-none pr-8 appearance-none cursor-pointer"
              required={field.is_required}
            >
              <option value="" className="bg-[#162236]">{field.placeholder || 'Select...'}</option>
              {options.map((opt: string) => (
                <option key={opt} value={opt} className="bg-[#162236]">{opt}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <i className="ri-arrow-down-s-line text-slate-500 w-4 h-4 flex items-center justify-center"></i>
            </div>
          </div>
        )}

        {field.field_type === 'checkbox' && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              id={key}
              name={key}
              type="checkbox"
              checked={value === 'true' || value === true}
              onChange={(e) => setValue(key, e.target.checked ? 'true' : 'false')}
              className="mt-1 w-4 h-4 accent-teal-500 flex-shrink-0 rounded"
              required={field.is_required}
            />
            <span className="text-sm text-slate-400 leading-relaxed">{field.help_text || field.field_label}</span>
          </label>
        )}

        {field.field_type === 'date' && (
          <input
            id={key}
            name={key}
            type="date"
            value={value || ''}
            onChange={(e) => setValue(key, e.target.value)}
            className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white outline-none"
            required={field.is_required}
          />
        )}

        {['text','email','tel','number','password'].includes(field.field_type) && (
          <div className="relative">
            <input
              id={key}
              name={key}
              type={field.field_type}
              value={value || ''}
              onChange={(e) => setValue(key, e.target.value)}
              className={`w-full px-4 py-3 ${field.field_key === 'hourly_rate' ? 'pl-8' : ''} bg-[#162236] border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none ${
                err ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder={field.placeholder || ''}
              required={field.is_required}
              min={field.field_type === 'number' ? 0 : undefined}
              step={field.field_type === 'number' ? 'any' : undefined}
            />
            {field.field_key === 'hourly_rate' && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">&pound;</span>
            )}
          </div>
        )}

        {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
        {field.field_type === 'textarea' && (
          <p className="text-xs text-slate-500 text-right">{(value || '').length}/500</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {displayError && (
          <div className="mb-6 bg-red-900/20 border border-red-700/40 rounded-xl p-4 flex items-start gap-3 animate-shake">
            <i className="ri-error-warning-line text-red-400 text-xl mt-0.5 w-5 h-5 flex items-center justify-center"></i>
            <div className="flex-1">
              <p className="text-red-300 font-medium">{displayError}</p>
            </div>
            <button onClick={() => { setError(''); setLoadError(''); }} className="text-red-400 hover:text-red-200 cursor-pointer">
              <i className="ri-close-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </button>
          </div>
        )}

        <ProfileWizard
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={(step) => { if (step <= currentStep) setCurrentStep(step); }}
          allowSkipAhead={false}
        />

        {currentStep === 1 && (
          <WizardCard
            title={`Welcome, ${userName}!`}
            icon="ri-hand-heart-line"
            description="Let&apos;s set up your security guard profile"
          >
            <div className="space-y-6">
              {isOAuthUser && (
                <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 flex items-center justify-center bg-[#162236] rounded-full shadow-md">
                      <i className={`${getProviderIcon()} text-2xl ${oauthProvider === 'google' ? 'text-red-400' : 'text-white'}`}></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">Successfully signed up with {getProviderName()}!</h3>
                      <p className="text-slate-400 text-sm">We&apos;ve imported your basic information. Just a few more details to complete your profile.</p>
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center bg-teal-500 rounded-full">
                      <i className="ri-check-line text-slate-900 text-xl"></i>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-8">
                <h3 className="text-2xl font-bold mb-4 text-white">
                  Complete Your Profile
                </h3>
                <p className="text-slate-400 mb-6">
                  Setting up your profile helps clients find you and understand your expertise.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                      <i className="ri-check-line text-teal-400 text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Get Hired Faster</h4>
                      <p className="text-sm text-slate-400">Complete profiles get 3x more job offers</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                      <i className="ri-shield-check-line text-teal-400 text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Build Trust</h4>
                      <p className="text-sm text-slate-400">Show your credentials and experience</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                      <i className="ri-money-pound-circle-line text-teal-400 text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Set Your Rate</h4>
                      <p className="text-sm text-slate-400">Control your earning potential</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                      <i className="ri-calendar-line text-teal-400 text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Flexible Schedule</h4>
                      <p className="text-sm text-slate-400">Work when it suits you</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-time-line text-teal-400 text-xl w-5 h-5 flex items-center justify-center"></i>
                  <div>
                    <h4 className="font-semibold text-teal-300 mb-1">Takes About 5 Minutes</h4>
                    <p className="text-sm text-teal-400">
                      You can save your progress and come back later.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </WizardCard>
        )}

        {currentStep === 3 && (
          <WizardCard
            title="SIA Licence Upload"
            icon="ri-shield-check-line"
            description="Upload your SIA licence for verification — files are stored securely and never publicly visible"
          >
            <div className="space-y-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    SIA Licence Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sia_licence_number || ''}
                    onChange={(e) => setValue('sia_licence_number', e.target.value)}
                    placeholder="e.g. 1234-5678-9012-3456"
                    className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={formData.license_cardholder_name || ''}
                      onChange={(e) => setValue('license_cardholder_name', e.target.value)}
                      placeholder="Name on the licence"
                      className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Expiry Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.sia_expiry_date || ''}
                      onChange={(e) => setValue('sia_expiry_date', e.target.value)}
                      className="w-full px-4 py-3 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">SIA Licence Images</h3>
                {(siaFrontPath || siaBackPath) && (
                  <div className="mb-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                    <p className="text-sm text-teal-300 flex items-center gap-2">
                      <i className="ri-check-line"></i>
                      You already have licence images on file. Upload new ones below to replace them.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {siaFrontPath ? (
                    <SIALicenceImage path={siaFrontPath} label="Front of Licence" className="border border-[#1e2d4d] rounded-xl" />
                  ) : (
                    <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                      <p className="text-sm text-slate-500">No front image on file</p>
                    </div>
                  )}
                  {siaBackPath ? (
                    <SIALicenceImage path={siaBackPath} label="Back of Licence" className="border border-[#1e2d4d] rounded-xl" />
                  ) : (
                    <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                      <p className="text-sm text-slate-500">No back image on file</p>
                    </div>
                  )}
                </div>
              </div>

              <SIALicenceUploader
                frontFile={siaLicenceFront}
                backFile={siaLicenceBack}
                frontPreview={siaFrontPreview}
                backPreview={siaBackPreview}
                onFrontChange={(file, preview) => { setSiaLicenceFront(file); setSiaFrontPreview(preview); setSiaFrontPath(''); }}
                onBackChange={(file, preview) => { setSiaLicenceBack(file); setSiaBackPreview(preview); setSiaBackPath(''); }}
                error={siaFileError}
                onError={setSiaFileError}
              />

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-teal-500/15 rounded-lg flex-shrink-0">
                  <i className="ri-lock-line text-teal-400 text-lg"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Your files are private</p>
                  <p className="text-xs text-slate-400">
                    Licence images are stored in a private, encrypted bucket. Only you and QuickGuard admins can view them. They are never shared publicly.
                  </p>
                </div>
              </div>
            </div>
          </WizardCard>
        )}

        {currentStep === 2 && (
          <WizardCard
            title="Add Your Profile Photo"
            icon="ri-camera-line"
            description="A professional photo helps clients recognize and trust you"
          >
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-6 py-8">
                <div className="relative">
                  <div className="w-40 h-40 rounded-full overflow-hidden bg-[#162236] border-4 border-slate-700/50 shadow-xl">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#162236]">
                        <i className="ri-user-line text-6xl text-teal-400"></i>
                      </div>
                    )}
                  </div>
                  {photoPreview && (
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 flex items-center justify-center bg-teal-500 rounded-full border-4 border-[#0B1933] shadow-lg">
                      <i className="ri-check-line text-slate-900 text-xl"></i>
                    </div>
                  )}
                  {useOAuthPhoto && oauthProvider && (
                    <div className="absolute -top-2 -right-2 w-10 h-10 flex items-center justify-center bg-[#162236] rounded-full border-2 border-slate-700/50 shadow-lg">
                      <i className={`${getProviderIcon()} text-lg ${oauthProvider === 'google' ? 'text-red-400' : 'text-white'}`}></i>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-medium hover:bg-teal-400 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-upload-2-line text-xl w-5 h-5 flex items-center justify-center"></i>
                    {photoPreview ? 'Upload Different Photo' : 'Upload Photo'}
                  </button>
                  {oauthAvatarUrl && !useOAuthPhoto && (
                    <button
                      type="button"
                      onClick={handleUseOAuthPhoto}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-slate-900 rounded-xl font-medium hover:bg-emerald-400 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className={`${getProviderIcon()} text-xl w-5 h-5 flex items-center justify-center`}></i>
                      Use {getProviderName()} Photo
                    </button>
                  )}
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#162236] text-slate-300 border border-slate-700/50 rounded-xl font-medium hover:bg-slate-700/50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-xl w-5 h-5 flex items-center justify-center"></i>
                      Remove
                    </button>
                  )}
                </div>

                {useOAuthPhoto && (
                  <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 text-center">
                    <p className="text-sm text-teal-300">
                      <i className="ri-check-line mr-1"></i>
                      Using your {getProviderName()} profile photo
                    </p>
                  </div>
                )}

                <div className="text-center max-w-md">
                  <p className="text-sm text-slate-500 mb-4">Max size: 5MB &middot; Formats: JPG, PNG, GIF</p>
                  <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-4">
                    <h4 className="font-semibold text-white mb-2 flex items-center justify-center gap-2">
                      <i className="ri-lightbulb-line w-5 h-5 flex items-center justify-center text-teal-400"></i>
                      Photo Tips
                    </h4>
                    <ul className="text-sm text-slate-400 space-y-1 text-left">
                      <li className="flex items-start gap-2"><i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>Use a clear, recent photo of yourself</li>
                      <li className="flex items-start gap-2"><i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>Face the camera and smile naturally</li>
                      <li className="flex items-start gap-2"><i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>Professional attire preferred</li>
                      <li className="flex items-start gap-2"><i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center"></i>Good lighting and plain background</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </WizardCard>
        )}

        {currentStep >= 5 && currentStep <= 8 && (
          <WizardCard
            title={WIZARD_STEPS[currentStep - 1].title}
            icon={WIZARD_STEPS[currentStep - 1].icon}
            description={WIZARD_STEPS[currentStep - 1].description}
          >
            <div className="space-y-5">
              {isOAuthUser && currentStep === 5 && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <i className={`${getProviderIcon()} text-xl ${oauthProvider === 'google' ? 'text-red-400' : 'text-white'} w-5 h-5 flex items-center justify-center`}></i>
                    <div>
                      <p className="text-sm text-teal-300">Your name and email were imported from {getProviderName()}. You can update them if needed.</p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                  <div className="relative">
                    <input type="email" value={userEmail} disabled className="w-full px-4 py-3 pl-12 border border-slate-600 rounded-xl bg-slate-800/60 text-slate-400 text-sm" />
                    <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl w-5 h-5 flex items-center justify-center"></i>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">This is your registered email address</p>
                </div>
              )}

              {currentStep === 8 && (
                <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-2">Set Your Password</h4>
                  <p className="text-xs text-slate-400 mb-4">Create a password so you can log in next time without a magic link. You can skip this if you prefer.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                          placeholder="Enter a password"
                          className="w-full px-4 py-3 pr-10 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        >
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className={`text-slate-400 hover:text-slate-300 ${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                          </div>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                          placeholder="Confirm your password"
                          className="w-full px-4 py-3 pr-10 bg-[#162236] border border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500 outline-none"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        >
                          <div className="w-5 h-5 flex items-center justify-center">
                            <i className={`text-slate-400 hover:text-slate-300 ${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                          </div>
                        </button>
                      </div>
                    </div>
                    {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                    {password && confirmPassword && password === confirmPassword && password.length >= 6 && (
                      <p className="text-xs text-teal-400 flex items-center gap-1">
                        <i className="ri-check-line"></i> Passwords match
                      </p>
                    )}
                  </div>
                </div>
              )}

              {fieldsForStep(currentStep).length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-[#162236] rounded-full mx-auto mb-3 flex items-center justify-center">
                    <i className="ri-file-list-3-line text-slate-500 text-xl"></i>
                  </div>
                  <p className="text-sm text-slate-400">No fields configured for this step</p>
                </div>
              ) : (
                fieldsForStep(currentStep).map(renderFieldInput)
              )}
            </div>
          </WizardCard>
        )}

        {currentStep === 4 && (
          <WizardCard
            title="Documents"
            icon="ri-file-list-3-line"
            description="Upload your driving licence and proof of address"
          >
            <div className="space-y-6">
              {(drivingFrontPath || drivingBackPath || poaPath) && (
                <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Documents on File</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {drivingFrontPath ? (
                      <DocumentImage path={drivingFrontPath} label="Driving Licence Front" className="border border-[#1e2d4d] rounded-xl" />
                    ) : (
                      <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                        <p className="text-sm text-slate-500">No driving licence front on file</p>
                      </div>
                    )}
                    {drivingBackPath ? (
                      <DocumentImage path={drivingBackPath} label="Driving Licence Back" className="border border-[#1e2d4d] rounded-xl" />
                    ) : (
                      <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                        <p className="text-sm text-slate-500">No driving licence back on file</p>
                      </div>
                    )}
                    {poaPath ? (
                      <DocumentImage path={poaPath} label="Proof of Address" className="border border-[#1e2d4d] rounded-xl" />
                    ) : (
                      <div className="bg-[#162036] border border-dashed border-[#1e2d4d] rounded-xl p-6 text-center">
                        <p className="text-sm text-slate-500">No proof of address on file</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <GuardDocumentsUploader
                drivingFrontFile={drivingLicenceFront}
                drivingBackFile={drivingLicenceBack}
                drivingFrontPreview={drivingFrontPreview}
                drivingBackPreview={drivingBackPreview}
                proofOfAddressFile={proofOfAddress}
                proofOfAddressPreview={proofOfAddressPreview}
                onDrivingFrontChange={(file, preview) => { setDrivingLicenceFront(file); setDrivingFrontPreview(preview); setDrivingFrontPath(''); }}
                onDrivingBackChange={(file, preview) => { setDrivingLicenceBack(file); setDrivingBackPreview(preview); setDrivingBackPath(''); }}
                onProofOfAddressChange={(file, preview) => { setProofOfAddress(file); setProofOfAddressPreview(preview); setPoaPath(''); }}
                error={docsFileError}
                onError={setDocsFileError}
              />
            </div>
          </WizardCard>
        )}

        <WizardNavigation
          currentStep={currentStep}
          totalSteps={WIZARD_STEPS.length}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isSubmitting={saving || uploadingPhoto || uploadingSia || uploadingDocs}
          submitLabel={uploadingDocs ? 'Uploading Documents...' : uploadingSia ? 'Uploading Licence...' : uploadingPhoto ? 'Uploading Photo...' : saving ? 'Saving...' : 'Complete Profile &amp; Continue'}
        />
      </div>
    </div>
  );
}

export default function GuardCompleteProfileWizard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    }>
      <GuardCompleteProfileWizardContent />
    </Suspense>
  );
}