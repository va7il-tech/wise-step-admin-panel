import { supabase } from './supabase';
import { randomId } from './utils';

/** Upload an image to the public `media` bucket, returns its public URL. */
export async function uploadToMedia(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${folder}/${randomId()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Upload an anonymous form attachment to the private `form-uploads` bucket, returns the storage path. */
export async function uploadFormFile(file: File, formId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${formId}/${randomId()}.${ext}`;
  const { error } = await supabase.storage.from('form-uploads').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Signed URL for staff to view a private form attachment. */
export async function signedFormFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('form-uploads').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
