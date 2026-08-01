import { supabase } from './supabase';

export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Upload error details:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Upload succeeded but failed to get public URL');
  }

  return data.publicUrl;
}

export async function deleteProfilePhoto(photoUrl: string): Promise<boolean> {
  try {
    const path = photoUrl.split('/avatars/')[1];
    if (!path) return false;

    const { error } = await supabase.storage
      .from('avatars')
      .remove([path]);

    return !error;
  } catch (error) {
    console.error('Error deleting photo:', error);
    return false;
  }
}

export async function uploadSIALicence(file: File, userId: string, side: 'front' | 'back'): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${side}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('sia-licences')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('SIA upload error details:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return filePath;
}

export async function uploadDrivingLicence(file: File, userId: string, side: 'front' | 'back'): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${side}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('guard-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Driving licence upload error details:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return filePath;
}

export async function uploadProofOfAddress(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `poa-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('guard-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Proof of address upload error details:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  return filePath;
}

async function logAdminDocumentAccess(bucket: string, path: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, username, full_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) return;

    await supabase.from('admin_activity_log').insert({
      admin_user_id: user.id,
      admin_username: adminUser.username,
      admin_name: adminUser.full_name,
      action: 'document_view',
      action_type: 'document_view',
      action_description: `Admin viewed ${bucket} document: ${path}`,
      entity_type: bucket,
      entity_id: path,
      target_type: 'storage_object',
      target_name: path,
      details: { bucket, path, accessed_at: new Date().toISOString() },
    });
  } catch {
  }
}

export async function getDocumentSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  void logAdminDocumentAccess('guard-documents', path);

  const { data, error } = await supabase.storage
    .from('guard-documents')
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function getSIALicenceSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  void logAdminDocumentAccess('sia-licences', path);

  const { data, error } = await supabase.storage
    .from('sia-licences')
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function getProfilePhotoUrl(photoUrl: string | null, expiresIn = 3600): Promise<string | null> {
  if (!photoUrl) return null;

  if (photoUrl.includes('/guard-profiles/')) {
    const path = photoUrl.split('/guard-profiles/')[1];
    if (!path) return photoUrl;

    const { data, error } = await supabase.storage
      .from('guard-profiles')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Failed to create signed URL for guard-profiles:', error.message);
      return photoUrl;
    }

    return data.signedUrl;
  }

  return photoUrl;
}

export async function deleteSIALicence(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('sia-licences')
      .remove([path]);

    return !error;
  } catch (error) {
    console.error('Error deleting SIA licence:', error);
    return false;
  }
}