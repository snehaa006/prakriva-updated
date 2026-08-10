// Persistence for the PCOD/PCOS skin tracker.
//
// Unlike the cycle and weight logs this one is *not* local-first. A skin
// check-in's whole point is the photo, and a photo cannot live in
// localStorage — a few phone photos would blow the ~5 MB quota and silently
// evict the cycle history stored beside it. So entries are written straight to
// Supabase, and a missing table or bucket is reported honestly rather than
// pretended around.
//
// Photos go to the private `acne-photos` storage bucket under
// `<patient-id>/<file>`, which is the prefix the storage policies key off (see
// supabase/pcos_tracking.sql). They are never public: the page renders them
// through short-lived signed URLs.

import { supabase } from "@/lib/supabase";
import type { AcneEntry, AcneRegion, AcneSeverity } from "@/lib/acneGuidance";
import { ACNE_SEVERITIES } from "@/lib/acneGuidance";

/** Postgres/PostgREST codes meaning "the table isn't there (yet)". */
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST106"];

const isMissingTable = (error: { code?: string } | null) =>
  !!error && MISSING_TABLE_CODES.includes(error.code ?? "");

/** Raised when the skin tracker's table or bucket has not been created. */
export class SkinTrackerUnavailableError extends Error {
  constructor(
    message = "Skin tracking isn't set up in this project yet — apply supabase/pcos_tracking.sql."
  ) {
    super(message);
    this.name = "SkinTrackerUnavailableError";
  }
}

export const ACNE_PHOTO_BUCKET = "acne-photos";

/** Largest photo we will upload, matching the backend's assessment limit. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const VALID_REGIONS: AcneRegion[] = [
  "forehead",
  "cheeks",
  "jawline",
  "chin",
  "neck",
  "back",
];

interface AcneRow {
  id: string;
  log_date: string;
  severity: string;
  regions: string[] | null;
  notes: string | null;
  photo_path: string | null;
  ai_severity: string | null;
  ai_observations: string | null;
}

const fromRow = (row: AcneRow): AcneEntry | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.log_date)) return null;
  if (!ACNE_SEVERITIES.includes(row.severity as AcneSeverity)) return null;

  return {
    id: row.id,
    date: row.log_date,
    severity: row.severity as AcneSeverity,
    regions: (row.regions ?? []).filter((r): r is AcneRegion =>
      VALID_REGIONS.includes(r as AcneRegion)
    ),
    notes: row.notes ?? "",
    photoPath: row.photo_path,
    aiSeverity: ACNE_SEVERITIES.includes(row.ai_severity as AcneSeverity)
      ? (row.ai_severity as AcneSeverity)
      : null,
    aiObservations: row.ai_observations,
  };
};

/** A patient's skin check-ins, oldest first. */
export const fetchAcneEntries = async (patientId: string): Promise<AcneEntry[]> => {
  const { data, error } = await supabase
    .from("acne_logs")
    .select(
      "id, log_date, severity, regions, notes, photo_path, ai_severity, ai_observations"
    )
    .eq("patient_id", patientId)
    .order("log_date", { ascending: false })
    .limit(60);

  if (error) {
    if (isMissingTable(error)) throw new SkinTrackerUnavailableError();
    throw new Error(error.message);
  }

  return ((data ?? []) as AcneRow[])
    .map(fromRow)
    .filter((e): e is AcneEntry => e !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
};

/** File extension for a photo, defaulting to jpg for an unrecognised type. */
const extensionFor = (file: File): string => {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] ?? "jpg";
};

/**
 * Upload a skin photo and return its storage path.
 *
 * The path is always prefixed with the patient's own id — the storage policies
 * only allow a patient to write under her own folder, so a wrong prefix is
 * rejected by the server rather than trusted from here.
 */
export const uploadAcnePhoto = async (
  patientId: string,
  file: File
): Promise<string> => {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("That photo is too large — try one under 8 MB.");
  }

  const path = `${patientId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(file)}`;

  const { error } = await supabase.storage
    .from(ACNE_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });

  if (error) {
    // Supabase reports a missing bucket as a plain message rather than a code.
    if (/bucket not found/i.test(error.message)) {
      throw new SkinTrackerUnavailableError(
        "The acne-photos storage bucket doesn't exist yet — see supabase/pcos_tracking.sql."
      );
    }
    throw new Error(error.message);
  }

  return path;
};

/**
 * A temporary URL for a stored photo.
 *
 * The bucket is private, so this is the only way to render one. Null rather
 * than throwing when the link cannot be made — a broken thumbnail should not
 * take the page down.
 */
export const signAcnePhoto = async (
  path: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(ACNE_PHOTO_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("Could not sign acne photo URL:", error);
    return null;
  }
  return data?.signedUrl ?? null;
};

export interface SaveAcneEntryArgs {
  patientId: string;
  date: string;
  severity: AcneSeverity;
  regions: AcneRegion[];
  notes: string;
  photoPath?: string | null;
  aiSeverity?: AcneSeverity | null;
  aiObservations?: string | null;
}

/** Record one skin check-in. One per patient per day; logging again corrects it. */
export const saveAcneEntry = async ({
  patientId,
  date,
  severity,
  regions,
  notes,
  photoPath = null,
  aiSeverity = null,
  aiObservations = null,
}: SaveAcneEntryArgs): Promise<AcneEntry> => {
  const { data, error } = await supabase
    .from("acne_logs")
    .upsert(
      {
        patient_id: patientId,
        log_date: date,
        severity,
        regions,
        notes,
        photo_path: photoPath,
        ai_severity: aiSeverity,
        ai_observations: aiObservations,
      },
      { onConflict: "patient_id,log_date" }
    )
    .select(
      "id, log_date, severity, regions, notes, photo_path, ai_severity, ai_observations"
    )
    .single();

  if (error) {
    if (isMissingTable(error)) throw new SkinTrackerUnavailableError();
    throw new Error(error.message);
  }

  const entry = fromRow(data as AcneRow);
  if (!entry) throw new Error("Saved, but the entry came back in an unexpected shape.");
  return entry;
};

/** Delete a check-in, and the photo behind it. */
export const deleteAcneEntry = async (
  patientId: string,
  entry: AcneEntry
): Promise<void> => {
  const { error } = await supabase
    .from("acne_logs")
    .delete()
    .eq("patient_id", patientId)
    .eq("id", entry.id);

  if (error && !isMissingTable(error)) throw new Error(error.message);

  // Best effort: an orphaned photo is a wasted object, a failed delete here
  // would be a lost entry the patient thinks is gone.
  if (entry.photoPath) {
    const { error: storageError } = await supabase.storage
      .from(ACNE_PHOTO_BUCKET)
      .remove([entry.photoPath]);
    if (storageError) console.error("Could not delete acne photo:", storageError);
  }
};
