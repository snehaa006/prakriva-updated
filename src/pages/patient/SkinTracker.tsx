// The PCOD/PCOS track's skin tracker.
//
// Acne is usually the symptom a PCOS patient wants fixed first, and unlike most
// of PCOS it is genuinely diet-responsive — so a dated photo series is worth
// having: it is the only measure here that a patient can see improving before
// her cycles do, and it feeds the same insulin-facing changes the rest of her
// plan is built on.
//
// Two things are deliberately separate on this page: what she rates the acne as
// (authoritative), and what the vision model says about the photo (a second
// opinion, shown beside it and never overwriting hers). See
// `src/lib/acneGuidance.ts` for why the recommendations only branch on the
// severity band.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Apple,
  ArrowLeft,
  Camera,
  Loader2,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/lifestyleLog";
import {
  ACNE_REGIONS,
  ACNE_SEVERITIES,
  ACNE_SEVERITY_LABELS,
  ACNE_TREND_LABELS,
  analyseAcne,
  buildAcneGuidance,
  type AcneEntry,
  type AcneRegion,
  type AcneSeverity,
} from "@/lib/acneGuidance";
import {
  SkinTrackerUnavailableError,
  deleteAcneEntry,
  fetchAcneEntries,
  saveAcneEntry,
  signAcnePhoto,
  uploadAcnePhoto,
} from "@/services/acneLogService";
import {
  AnalysisUnavailableError,
  assessAcnePhoto,
  isAnalysisEnabled,
} from "@/services/analysisService";

const SEVERITY_STYLES: Record<AcneSeverity, string> = {
  clear: "bg-accent-soft text-accent-soft-foreground border-transparent",
  mild: "bg-accent-soft text-accent-soft-foreground border-transparent",
  moderate: "bg-warning/10 text-warning border-warning/20",
  severe: "bg-destructive text-destructive-foreground border-transparent",
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const SkinTracker = () => {
  const navigate = useNavigate();
  const today = todayIso();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [patientId, setPatientId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AcneEntry[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [canAssessPhotos, setCanAssessPhotos] = useState(false);

  const [date, setDate] = useState(today);
  const [severity, setSeverity] = useState<AcneSeverity>("mild");
  const [regions, setRegions] = useState<AcneRegion[]>([]);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    isAnalysisEnabled().then((enabled) => {
      if (!cancelled) setCanAssessPhotos(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The object URL for the pending photo has to be revoked, or every retake
  // leaks a blob for the life of the page.
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const loadEntries = useCallback(async (id: string) => {
    try {
      const loaded = await fetchAcneEntries(id);
      setEntries(loaded);
      setUnavailable(null);

      // Signed URLs, because the bucket is private. Failures render as a
      // missing thumbnail rather than taking the list down.
      const signed = await Promise.all(
        loaded
          .filter((e) => e.photoPath)
          .map(async (e) => [e.id, await signAcnePhoto(e.photoPath as string)] as const)
      );
      setPhotoUrls(
        Object.fromEntries(signed.filter(([, url]) => url) as [string, string][])
      );
    } catch (error) {
      if (error instanceof SkinTrackerUnavailableError) setUnavailable(error.message);
      else console.error("Error loading skin check-ins:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      if (cancelled) return;
      setPatientId(user.id);
      await loadEntries(user.id);
      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [loadEntries]);

  const analysis = useMemo(() => analyseAcne(entries), [entries]);
  const guidance = useMemo(() => buildAcneGuidance(analysis), [analysis]);

  const toggleRegion = (region: AcneRegion) =>
    setRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );

  const handleSave = useCallback(async () => {
    if (!patientId) return;
    setIsSaving(true);

    try {
      let photoPath: string | null = null;
      let aiSeverity: AcneSeverity | null = null;
      let aiObservations: string | null = null;

      if (photo) {
        // The assessment runs before the upload: if Gemini is unreachable we
        // still want the photo and the check-in saved, and if the upload fails
        // there is no point having spent an API call.
        if (canAssessPhotos) {
          try {
            const assessment = await assessAcnePhoto(photo);
            aiSeverity = assessment.severity;
            aiObservations = assessment.observations || null;
          } catch (error) {
            if (!(error instanceof AnalysisUnavailableError)) {
              console.error("Photo assessment failed:", error);
            }
            toast.info("Saved your check-in — the photo read isn't available right now.");
          }
        }
        photoPath = await uploadAcnePhoto(patientId, photo);
      }

      await saveAcneEntry({
        patientId,
        date,
        severity,
        regions,
        notes: notes.trim(),
        photoPath,
        aiSeverity,
        aiObservations,
      });

      await loadEntries(patientId);
      setPhoto(null);
      setNotes("");
      setRegions([]);
      setDate(today);
      toast.success("Skin check-in saved");
    } catch (error) {
      if (error instanceof SkinTrackerUnavailableError) {
        setUnavailable(error.message);
        toast.error("Skin tracking isn't set up in this project yet.");
      } else {
        console.error("Error saving skin check-in:", error);
        toast.error(
          error instanceof Error ? error.message : "Could not save your check-in."
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [patientId, photo, canAssessPhotos, date, severity, regions, notes, today, loadEntries]);

  const handleDelete = useCallback(
    async (entry: AcneEntry) => {
      if (!patientId) return;
      try {
        await deleteAcneEntry(patientId, entry);
        await loadEntries(patientId);
        toast.success("Check-in removed");
      } catch (error) {
        console.error("Error deleting skin check-in:", error);
        toast.error("Could not remove that check-in.");
      }
    },
    [patientId, loadEntries]
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-foreground-tertiary" />
      </div>
    );
  }

  const TrendIcon =
    analysis.trend === "improving"
      ? TrendingDown
      : analysis.trend === "worsening"
        ? TrendingUp
        : Sparkles;

  return (
    <div className="mx-auto max-w-5xl flex-1 space-y-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-title1 text-foreground">Skin &amp; Acne</h1>
          <p className="mt-1.5 max-w-lg text-subhead text-foreground-secondary">
            Photograph your skin every couple of weeks — what changes tells us what your
            nutrition should change.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/patient/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {unavailable && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/10 p-4 text-footnote text-foreground">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{unavailable}</span>
        </div>
      )}

      {/* ── New check-in ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            New skin check-in
          </CardTitle>
          <CardDescription>
            Same light, same time of day, no makeup — a series only means something if
            the photos are comparable. Photos are private to your account and never
            shown to anyone but you and your doctor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xs">
            <Label htmlFor="skin-date">Date</Label>
            <Input
              id="skin-date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <span className="text-subhead font-medium text-foreground">How would you rate it today?</span>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {ACNE_SEVERITIES.map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={severity === level ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setSeverity(level)}
                >
                  {ACNE_SEVERITY_LABELS[level]}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-subhead font-medium text-foreground">Where?</span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ACNE_REGIONS.map((region) => {
                const selected = regions.includes(region.value);
                return (
                  <button
                    key={region.value}
                    type="button"
                    onClick={() => toggleRegion(region.value)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3.5 py-1.5 text-footnote font-medium transition-colors duration-200 ease-ios ${
                      selected
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border text-foreground-secondary hover:bg-muted"
                    }`}
                  >
                    {region.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-subhead font-medium text-foreground">Photo (optional)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {/* `capture` asks a phone for the camera directly; desktops ignore
                it and fall back to the file picker. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Take a photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              {photo && (
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => setPhoto(null)}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Photo you are about to save"
                className="mt-3 max-h-48 rounded-xl border border-border object-contain"
              />
            )}
            {photo && canAssessPhotos && (
              <p className="mt-2.5 text-footnote text-foreground-tertiary">
                We'll also ask our assistant what it can see in the photo. Your own
                rating is what the recommendations use — that read is just recorded
                beside it.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="skin-notes">Notes</Label>
            <Textarea
              id="skin-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="New product, a stressful week, a change in your diet..."
              className="mt-1.5"
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving || !!unavailable} size="lg" className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save check-in"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Where you are ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Right now</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {analysis.severity ? ACNE_SEVERITY_LABELS[analysis.severity] : "—"}
            </div>
            <p className="mt-1 text-caption1 text-foreground-tertiary">
              {analysis.entryCount} check-in{analysis.entryCount === 1 ? "" : "s"} logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Direction</CardTitle>
            <TrendIcon className="h-4 w-4 text-vata" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">{ACNE_TREND_LABELS[analysis.trend]}</div>
            <p className="mt-1 text-caption1 text-foreground-tertiary">
              across your last few check-ins
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-footnote font-medium text-foreground-secondary">Pattern</CardTitle>
            <Stethoscope className="h-4 w-4 text-pitta" />
          </CardHeader>
          <CardContent>
            <div className="text-title2 text-foreground">
              {analysis.isHormonalPattern ? "Hormonal" : "Mixed"}
            </div>
            <p className="mt-1 text-caption1 text-foreground-tertiary">
              {analysis.persistentRegions.length > 0
                ? analysis.persistentRegions
                    .map((r) => ACNE_REGIONS.find((a) => a.value === r)?.label ?? r)
                    .join(", ")
                : "log where the spots are to see this"}
            </p>
          </CardContent>
        </Card>
      </div>

      {guidance.seeADoctor && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-footnote text-foreground">
          <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            What you've logged is beyond what food and a routine will fix on their own.
            Scarring is much easier to prevent than to treat — book an appointment, and
            keep the nutrition changes going alongside.
          </span>
        </div>
      )}

      {/* ── What to change ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-primary" />
              Nutrition changes
            </CardTitle>
            <CardDescription>
              These feed into the diet plan your doctor generates for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {guidance.nutrition.map((item) => (
              <div key={item.key} className="rounded-xl bg-accent-soft p-4">
                <h4 className="text-subhead font-medium text-accent-soft-foreground">{item.title}</h4>
                <p className="mt-1 text-footnote text-foreground-secondary">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Skincare
            </CardTitle>
            <CardDescription>
              General guidance — nothing here replaces a dermatologist
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {guidance.skincare.map((item) => (
              <div key={item.key} className="rounded-xl bg-muted p-4">
                <h4 className="text-subhead font-medium text-foreground">{item.title}</h4>
                <p className="mt-1 text-footnote text-foreground-secondary">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── History ── */}
      <Card>
        <CardHeader>
          <CardTitle>Your check-ins</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Camera className="h-5 w-5" />
              </span>
              <p className="max-w-xs text-footnote text-foreground-secondary">
                Nothing logged yet. Your first check-in is the baseline everything after it
                is compared against.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {[...entries].reverse().map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-4 rounded-xl border border-border p-4 transition-colors duration-200 ease-ios hover:bg-muted/40"
                >
                  {photoUrls[entry.id] ? (
                    <img
                      src={photoUrls[entry.id]}
                      alt={`Skin on ${prettyDate(entry.date)}`}
                      className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Camera className="h-5 w-5 text-foreground-tertiary" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-subhead font-medium text-foreground">{prettyDate(entry.date)}</span>
                      <Badge variant="outline" className={SEVERITY_STYLES[entry.severity]}>
                        {ACNE_SEVERITY_LABELS[entry.severity]}
                      </Badge>
                      {entry.aiSeverity && entry.aiSeverity !== entry.severity && (
                        <Badge variant="outline" className="border-border text-foreground-tertiary">
                          photo read: {entry.aiSeverity}
                        </Badge>
                      )}
                    </div>
                    {entry.regions.length > 0 && (
                      <p className="mt-1 text-footnote text-foreground-secondary">
                        {entry.regions
                          .map((r) => ACNE_REGIONS.find((a) => a.value === r)?.label ?? r)
                          .join(", ")}
                      </p>
                    )}
                    {entry.aiObservations && (
                      <p className="mt-1 text-footnote italic text-foreground-tertiary">
                        {entry.aiObservations}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="mt-1 text-footnote text-foreground-secondary">{entry.notes}</p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove check-in from ${prettyDate(entry.date)}`}
                    onClick={() => handleDelete(entry)}
                  >
                    <Trash2 className="h-4 w-4 text-foreground-tertiary" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SkinTracker;
