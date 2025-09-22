// server-only file
import { supabase } from "@/lib/supabase/server";

export async function putToStorage(bucket: string, key: string, data: Buffer | Uint8Array, contentType: string) {
  const { error } = await supabase.storage.from(bucket).upload(key, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return { bucket, key };
}

export async function getSignedUrl(bucket: string, key: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, expiresIn);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}
