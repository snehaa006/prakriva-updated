// Profile photos.
//
// A photo has to survive a refresh and show up on every device, but the app
// cannot assume a storage bucket has been created in Supabase — so this tries
// the good path and degrades instead of failing:
//
// 1. Upload to the `avatars` storage bucket and use its public URL.
// 2. If that bucket doesn't exist (or RLS refuses), keep the picture as a
//    compressed data URL instead. It still shows everywhere in the app and
//    still survives a refresh; it just lives on this device.
//
// Either way the resulting URL is written to the Supabase **auth user's
// metadata**, which needs no schema change and is read back on sign-in, so the
// photo follows the account across devices whenever the upload path worked.
//
// Pictures are downscaled and re-encoded before any of that: a 6 MB phone
// photo is not what a 40px sidebar avatar needs, and a data URL of one would
// not fit in localStorage.

import { supabase } from "@/lib/supabase";
import { readCache, writeCache, clearCache } from "@/lib/localCache";

const BUCKET = "avatars";

/** Longest edge of the stored image, in pixels. */
const MAX_DIMENSION = 512;

/** JPEG quality for the re-encoded photo. */
const QUALITY = 0.85;

/** Anything larger is rejected before it is read, to keep the tab responsive. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const cacheKey = (userId: string) => `avatar:${userId}`;

export class AvatarError extends Error {}

/** Read an image file into a square-cropped, downscaled JPEG data URL. */
export const prepareImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      reject(new AvatarError("Choose a JPEG, PNG, WebP or GIF image."));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new AvatarError("That image is larger than 8 MB. Please choose a smaller one."));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      try {
        // Square crop from the centre — the avatar is a circle everywhere it
        // is shown, so cropping here beats letting CSS decide per screen.
        const edge = Math.min(image.width, image.height);
        const size = Math.min(edge, MAX_DIMENSION);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");
        if (!context) throw new AvatarError("Your browser could not process that image.");

        context.drawImage(
          image,
          (image.width - edge) / 2,
          (image.height - edge) / 2,
          edge,
          edge,
          0,
          0,
          size,
          size
        );
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      } catch (error) {
        reject(error instanceof Error ? error : new AvatarError("Could not read that image."));
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarError("That file could not be opened as an image."));
    };

    image.src = url;
  });

/** Turn a data URL back into bytes for upload. */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/** The photo cached on this device, if any. */
export const readCachedAvatar = (userId: string): string | null =>
  readCache<string>(cacheKey(userId));

export interface SaveAvatarResult {
  url: string;
  /** False when the photo is only on this device (no storage bucket). */
  synced: boolean;
}

/**
 * Store `file` as the user's photo and return the URL to render.
 *
 * Never throws for a missing bucket — that is the expected state of a fresh
 * Supabase project, and a local photo is better than an error.
 */
export const saveAvatar = async (userId: string, file: File): Promise<SaveAvatarResult> => {
  const dataUrl = await prepareImage(file);

  // Local copy first: it is what makes the new photo appear instantly, and
  // what remains if every remote path fails.
  writeCache(cacheKey(userId), dataUrl);

  let url = dataUrl;
  let synced = false;

  try {
    const path = `${userId}/avatar.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/jpeg" });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Cache-bust: the path is stable across uploads, so without this the
    // browser keeps showing the previous photo.
    url = `${data.publicUrl}?v=${Date.now()}`;
    synced = true;
  } catch (error) {
    console.warn("Avatar upload unavailable; keeping the photo on this device:", error);
  }

  try {
    // Only a real URL is worth putting in user metadata — a data URL would
    // bloat every session token for no benefit.
    if (synced) await supabase.auth.updateUser({ data: { avatar_url: url } });
  } catch (error) {
    console.warn("Could not record the photo on your account:", error);
  }

  return { url, synced };
};

/** Remove the photo everywhere we might have put it. */
export const removeAvatar = async (userId: string): Promise<void> => {
  clearCache(cacheKey(userId));

  try {
    await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`]);
  } catch (error) {
    console.warn("Could not remove the stored photo:", error);
  }

  try {
    await supabase.auth.updateUser({ data: { avatar_url: null } });
  } catch (error) {
    console.warn("Could not clear the photo on your account:", error);
  }
};

/** The photo to show for a user: the account's, else this device's copy. */
export const resolveAvatar = (
  userId: string,
  metadataUrl?: string | null
): string | undefined => metadataUrl ?? readCachedAvatar(userId) ?? undefined;

/** Initials for the fallback circle when there is no photo. */
export const initialsOf = (name?: string): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};
