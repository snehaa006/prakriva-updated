import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, X, User, Heart, Star, MessageSquare, Phone, Mail, Calendar, Target, MapPin, Apple, HeartPulse, IdCard, Copy, Check } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useCachedPageData } from "@/hooks/useCachedPageData";
import { supabase } from "@/lib/supabase";

/**
 * The profile holds only traits that stay the same over time.
 *
 * Values that shift week to week — stress, energy, sleep, hydration, activity,
 * cravings, current conditions, goals — live in the trackers, so they are
 * neither collected by the questionnaire nor shown here.
 */
interface AssessmentData {
  // Personal Information
  name: string;
  dob: string;
  gender: string;
  location: string;

  // Allergies & Food Avoidances
  allergies: string[];
  allergiesOther: string;
  foodAvoidances: string;

  // Long-standing dietary pattern
  dietaryPreferences: string;

  // Family History
  familyHistory: string[];
  familyHistoryOther: string;

  // Ayurvedic Constitutional Assessment (Prakriti — fixed at birth)
  bodyFrame: string;
  skinType: string;
  hairType: string;
  appetitePattern: string;
  personalityTraits: string[];
  weatherPreference: string;

  additionalNotes: string;
}

interface PatientData {
  patientId?: string;
  name: string;
  email: string;
  uid: string;
  role: string;
  questionnaireCompleted?: boolean;
  createdAt: string;
  profileCompleted?: boolean;
  registrationDate?: string;
  status?: string;
  assessmentData?: AssessmentData;
  updatedAt?: string;
}

/** The patient's own record, mapped out of the `patients` row. */
const fetchPatientProfile = async (patientId: string): Promise<PatientData | null> => {
  const { data: row, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  return {
    patientId: row.patient_code,
    name: row.name,
    email: row.email,
    uid: row.id,
    role: "patient",
    questionnaireCompleted: row.questionnaire_completed,
    createdAt: row.created_at,
    profileCompleted: row.profile_completed,
    registrationDate: row.registration_date,
    status: row.status,
    assessmentData: row.assessment_data ?? undefined,
    updatedAt: row.updated_at,
  };
};

export default function Profile() {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [originalData, setOriginalData] = useState<AssessmentData | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [patientIdCopied, setPatientIdCopied] = useState(false);

  const [feedbackData, setFeedbackData] = useState({
    rating: 5,
    message: "",
    category: "general" as "general" | "features" | "bug" | "suggestion"
  });

  // Cached, so leaving the profile and coming back re-renders it rather than
  // reloading the same row behind a spinner.
  const { data: loadedProfile, error, isFirstLoad: loading } = useCachedPageData(
    ["patient-profile", user?.id ?? null],
    () => fetchPatientProfile(user!.id),
    { enabled: !!user?.id }
  );

  useEffect(() => {
    if (!error) return;
    console.error("Error fetching patient data:", error);
    toast({
      title: "Error",
      description: "Failed to load profile data. Please try again.",
      variant: "destructive",
    });
  }, [error, toast]);

  useEffect(() => {
    if (loadedProfile === undefined) return;

    if (loadedProfile === null) {
      toast({
        title: "Profile Not Found",
        description: "Your profile could not be found. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setPatientData(loadedProfile);

    // Editing works off a local copy, so only seed it when the form is not
    // open — a background refresh must not discard changes being made.
    const assessment = loadedProfile.assessmentData as AssessmentData | undefined;
    if (assessment && !isEditing) {
      setAssessmentData(assessment);
      setOriginalData(assessment);
    }
    // `isEditing` is deliberately not a dependency: this seeds from loaded data,
    // and re-running it when the form opens or closes would undo edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProfile, toast]);

  const handleSave = async () => {
    if (!user?.id || !assessmentData || !patientData) return;

    try {
      // Update both assessment data and patient info. Only columns that
      // actually exist on public.patients are written — patient_code, id and
      // the timestamps are managed by the database.
      const { error } = await supabase
        .from("patients")
        .update({
          name: assessmentData.name ?? patientData.name,
          assessment_data: assessmentData,
          profile_completed: true, // Mark profile as completed when saved
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update user context if name changed
      if (user.name !== assessmentData.name) {
        setUser({
          ...user,
          name: assessmentData.name,
        });
      }
      
      // Update local state
      setPatientData(prev => prev ? {
        ...prev,
        name: assessmentData.name ?? prev.name,
        assessmentData,
        profileCompleted: true,
        updatedAt: new Date().toISOString(),
      } : null);
      setOriginalData(assessmentData);
      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (originalData) {
      setAssessmentData(originalData);
    }
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof AssessmentData, value: unknown) => {
    if (!assessmentData) return;
    setAssessmentData({
      ...assessmentData,
      [field]: value
    });
  };

  const handleCopyPatientId = async () => {
    if (patientData?.patientId) {
      try {
        await navigator.clipboard.writeText(patientData.patientId);
        setPatientIdCopied(true);
        toast({
          title: "Patient ID Copied",
          description: "Your Patient ID has been copied to clipboard.",
        });
        setTimeout(() => setPatientIdCopied(false), 2000);
      } catch (error) {
        console.error("Failed to copy patient ID:", error);
        toast({
          title: "Copy Failed",
          description: "Failed to copy Patient ID. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleFeedbackSubmit = () => {
    toast({
      title: "Feedback Submitted",
      description: "Thank you for your valuable feedback. We appreciate your input!",
    });
    setFeedbackData({
      rating: 5,
      message: "",
      category: "general"
    });
  };

  const calculateAge = (dob: string) => {
    if (!dob) return "Not specified";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} years`;
  };

  const formatArrayToString = (arr: string[], other?: string) => {
    if (!arr || arr.length === 0) return other || "Not specified";
    const items = arr.filter(item => item !== "none");
    if (arr.includes("none")) return "None";
    const result = items.join(", ");
    return other ? `${result}${result ? ", " : ""}${other}` : result;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not available";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return "Invalid date";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="text-footnote text-foreground-secondary">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="mx-auto max-w-sm py-16 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
          <HeartPulse className="w-7 h-7" />
        </span>
        <h2 className="text-headline text-foreground">Profile not found</h2>
        <p className="mt-2 text-footnote text-foreground-secondary">
          Your patient profile could not be loaded. Please contact support.
        </p>
        <Button className="mt-5" onClick={() => window.location.href = '/patient/questionnaire'}>
          Complete assessment
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <Avatar className="h-16 w-16 shrink-0 shadow-sm sm:h-20 sm:w-20">
              <AvatarFallback className="bg-accent-soft text-title3 font-semibold text-primary sm:text-title2">
                {patientData.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-title2 text-foreground sm:text-title1">{patientData.name}</h1>
              <p className="mt-0.5 truncate text-footnote text-foreground-secondary">{patientData.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {assessmentData?.location && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="w-3 h-3" />
                    {assessmentData.location}
                  </Badge>
                )}
                {assessmentData?.dob && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {calculateAge(assessmentData.dob)}
                  </Badge>
                )}
                {patientData.registrationDate && (
                  <span className="text-caption1 text-foreground-tertiary">
                    Member since {formatDate(patientData.registrationDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            {isEditing ? (
              <>
                <Button onClick={handleSave} className="h-11 flex-1 gap-2 sm:flex-initial">
                  <Save className="w-4 h-4" />
                  Save changes
                </Button>
                <Button onClick={handleCancel} variant="outline" className="h-11 flex-1 gap-2 sm:flex-initial">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="outline" className="h-11 w-full gap-2 sm:w-auto">
                <Edit className="w-4 h-4" />
                Edit profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Patient ID Information Card */}
      {patientData.patientId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
                <IdCard className="w-5 h-5" />
              </span>
              Patient information
            </CardTitle>
            <CardDescription>Your unique patient identification and account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
                <div className="min-w-0">
                  <p className="text-caption1 font-medium text-foreground-secondary">Patient ID</p>
                  <p className="truncate text-title3 font-mono font-bold text-primary">{patientData.patientId}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPatientId}
                  className="h-10 shrink-0 gap-2"
                >
                  {patientIdCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-caption1 font-medium text-foreground-secondary">Account status</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <Badge variant="outline" className="capitalize">
                    {patientData.status || 'Active'}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-caption1 font-medium text-foreground-secondary">Profile status</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${patientData.profileCompleted ? 'bg-success' : 'bg-warning'}`} />
                  <Badge variant="outline" className="capitalize">
                    {patientData.profileCompleted ? 'Complete' : 'Incomplete'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-accent-soft/60 p-4">
              <p className="text-footnote text-accent-soft-foreground">
                <strong>Note:</strong> Keep your Patient ID handy — you'll need it for appointments,
                medical records, and when contacting support.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show message if no assessment data */}
      {!assessmentData ? (
        <Card className="bg-accent-soft/40">
          <CardContent className="pt-6">
            <div className="mx-auto max-w-sm py-4 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
                <HeartPulse className="w-7 h-7" />
              </span>
              <h3 className="text-headline text-foreground">Complete your health assessment</h3>
              <p className="mt-2 text-footnote text-foreground-secondary">
                A few minutes of questions is all it takes to unlock personalized recommendations
                built around you.
              </p>
              <Button className="mt-5" onClick={() => window.location.href = '/patient/questionnaire'}>
                Start assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
                    <User className="w-5 h-5" />
                  </span>
                  Personal information
                </CardTitle>
                <CardDescription>Your basic profile details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-footnote font-medium text-foreground-secondary">Full name</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={assessmentData.name || patientData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                      <User className="w-4 h-4 text-foreground-tertiary" />
                      <span className="text-subhead text-foreground">{assessmentData.name || patientData.name}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-footnote font-medium text-foreground-secondary">Date of birth</Label>
                  {isEditing ? (
                    <Input
                      id="dob"
                      type="date"
                      value={assessmentData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                      <Calendar className="w-4 h-4 text-foreground-tertiary" />
                      <span className="text-subhead text-foreground">{assessmentData.dob || "Not specified"} ({calculateAge(assessmentData.dob)})</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-footnote font-medium text-foreground-secondary">Gender</Label>
                  {isEditing ? (
                    <Select
                      value={assessmentData.gender}
                      onValueChange={(value) => handleInputChange('gender', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="prefer-not-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                      <User className="w-4 h-4 text-foreground-tertiary" />
                      <span className="text-subhead capitalize text-foreground">{assessmentData.gender?.replace('-', ' ') || "Not specified"}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-footnote font-medium text-foreground-secondary">Location</Label>
                  {isEditing ? (
                    <Input
                      id="location"
                      value={assessmentData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="City, State"
                    />
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                      <MapPin className="w-4 h-4 text-foreground-tertiary" />
                      <span className="text-subhead text-foreground">{assessmentData.location || "Not specified"}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Allergies & Dietary Pattern */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
                    <Apple className="w-5 h-5" />
                  </span>
                  Allergies & dietary pattern
                </CardTitle>
                <CardDescription>Foods you always avoid and how you eat</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Dietary preference</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Badge variant="outline" className="capitalize">
                      {assessmentData.dietaryPreferences || "Not specified"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Food allergies</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-subhead text-foreground">{formatArrayToString(assessmentData.allergies, assessmentData.allergiesOther)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Foods avoided</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-subhead text-foreground">{assessmentData.foodAvoidances || "Not specified"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Family history</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-subhead text-foreground">{formatArrayToString(assessmentData.familyHistory, assessmentData.familyHistoryOther)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ayurvedic Constitution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <Heart className="w-5 h-5" />
                </span>
                Ayurvedic constitution assessment
              </CardTitle>
              <CardDescription>Your body constitution and characteristics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Body frame</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Badge variant="outline" className="capitalize">
                      {assessmentData.bodyFrame || "Not specified"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Skin type</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Badge variant="outline" className="capitalize">
                      {assessmentData.skinType || "Not specified"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Hair type</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Badge variant="outline" className="capitalize">
                      {assessmentData.hairType || "Not specified"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Appetite pattern</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Badge variant="outline" className="capitalize">
                      {assessmentData.appetitePattern || "Not specified"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Weather preference</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <Badge variant="outline" className="capitalize">
                      {assessmentData.weatherPreference || "Not specified"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-footnote font-medium text-foreground-secondary">Personality traits</Label>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {assessmentData.personalityTraits && assessmentData.personalityTraits.length > 0 ? (
                        assessmentData.personalityTraits.map((trait, index) => (
                          <Badge key={index} variant="secondary" className="capitalize">
                            {trait.replace('-', ' ')}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-footnote text-foreground-tertiary">Not specified</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
                  <Target className="w-5 h-5" />
                </span>
                Additional notes
              </CardTitle>
              <CardDescription>Long-standing details a practitioner should always know</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-subhead text-foreground">{assessmentData.additionalNotes || "Not specified"}</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Feedback Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
              <MessageSquare className="w-5 h-5" />
            </span>
            Share your feedback
          </CardTitle>
          <CardDescription>Help us improve your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-footnote font-medium text-foreground-secondary">Overall rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setFeedbackData({ ...feedbackData, rating: star })}
                  className="flex h-11 w-11 items-center justify-center transition-transform hover:scale-110"
                  aria-label={`Rate ${star} out of 5`}
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= feedbackData.rating
                        ? 'fill-primary text-primary'
                        : 'text-border-strong'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-1 text-subhead font-medium text-foreground">{feedbackData.rating}/5</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-footnote font-medium text-foreground-secondary">Feedback category</Label>
            <Select
              value={feedbackData.category}
              onValueChange={(value: "general" | "features" | "bug" | "suggestion") =>
                setFeedbackData({ ...feedbackData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General feedback</SelectItem>
                <SelectItem value="features">Feature request</SelectItem>
                <SelectItem value="bug">Bug report</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-footnote font-medium text-foreground-secondary">Your message</Label>
            <Textarea
              value={feedbackData.message}
              onChange={(e) => setFeedbackData({ ...feedbackData, message: e.target.value })}
              placeholder="Share your thoughts, suggestions, or report any issues..."
              className="min-h-[110px] resize-none"
            />
          </div>

          <Button onClick={handleFeedbackSubmit} className="w-full gap-2">
            <MessageSquare className="w-4 h-4" />
            Submit feedback
          </Button>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-primary">
              <Phone className="w-5 h-5" />
            </span>
            Contact & support
          </CardTitle>
          <CardDescription>Get in touch with our team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <Mail className="w-5 h-5 text-foreground-tertiary" />
              <div>
                <p className="text-subhead font-medium text-foreground">Email support</p>
                <p className="text-footnote text-foreground-secondary">support@ayurvedaapp.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <Phone className="w-5 h-5 text-foreground-tertiary" />
              <div>
                <p className="text-subhead font-medium text-foreground">Phone support</p>
                <p className="text-footnote text-foreground-secondary">+1 (555) 123-4567</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}