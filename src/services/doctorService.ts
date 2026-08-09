// services/doctorService.ts
import { supabase } from '@/lib/supabase';

// Enhanced type definitions
export interface Doctor {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  ayurvedicCertification?: string;
  ayurvedicSpecialization?: string[];
  clinicName?: string;
  clinicAddress?: string;
  yearsOfExperience: number;
  licenseNumber?: string;
  licenseVerified: boolean;
  verificationStatus: 'verified' | 'pending' | 'unverified';
  isActive: boolean;
  verificationPriority: number;
  consultationFee?: string;
  consultationModes?: string[];
  languages?: string[];
  workingHours?: string;
  rating?: number;
  totalConsultations: number;
  totalReviews: number;
  pendingRequests: number;
  bio?: string;
  education?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  medicalHistory: string[];
  allergies: string[];
  currentMedications: string[];
  assessmentData?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  requestType: 'consultation' | 'dietitian' | 'general';
  urgency: 'low' | 'medium' | 'high';
  message?: string;
  preferredConsultationMode?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  requestedAt: string;
  statusUpdatedAt?: string;
  patientNotified?: boolean;
  doctorNotified?: boolean;
  fullPatientProfile?: any;
}

export interface CreateConsultationRequest {
  doctorId: string;
  requestType: 'consultation' | 'dietitian' | 'general';
  urgency: 'low' | 'medium' | 'high';
  message?: string;
  preferredConsultationMode?: string;
}

/* ------------------------------- row mappers ------------------------------- */

const mapDoctor = (row: any): Doctor => ({
  id: row.id,
  name: row.name || 'Unknown Doctor',
  email: row.email || '',
  phoneNumber: row.phone_number || undefined,

  ayurvedicCertification: row.ayurvedic_certification || undefined,
  ayurvedicSpecialization: row.ayurvedic_specialization ?? [],
  clinicName: row.clinic_name || undefined,
  clinicAddress: row.clinic_address || undefined,
  yearsOfExperience: row.years_of_experience ?? 0,
  licenseNumber: row.license_number || undefined,
  licenseVerified: row.license_verified ?? false,

  verificationStatus: row.verification_status || 'unverified',
  isActive: row.is_active !== false,
  verificationPriority: getVerificationPriority(row.verification_status || 'unverified'),

  consultationFee: row.consultation_fee?.toString() || undefined,
  consultationModes: row.consultation_modes ?? ['in-person'],
  languages: row.languages ?? ['English'],
  workingHours: row.working_hours || undefined,

  rating: typeof row.rating === 'number' ? row.rating : Number(row.rating ?? 0),
  totalConsultations: row.total_consultations ?? 0,
  totalReviews: row.total_reviews ?? 0,
  pendingRequests: row.pending_requests ?? 0,

  bio: row.bio || undefined,
  education: row.education ?? [],

  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPatient = (row: any): Patient => ({
  id: row.id,
  name: row.name || 'Unknown Patient',
  email: row.email || '',
  phoneNumber: row.phone_number || undefined,

  age: row.assessment_data?.age ?? row.age ?? undefined,
  gender: row.assessment_data?.gender ?? row.gender ?? undefined,
  bloodGroup: row.blood_group || undefined,
  address: row.assessment_data?.location ?? row.address ?? undefined,
  emergencyContact: row.emergency_contact || undefined,

  medicalHistory: row.assessment_data?.currentConditions ?? row.medical_history ?? [],
  allergies: row.assessment_data?.allergies ?? row.allergies ?? [],
  currentMedications: row.assessment_data?.medications
    ? [row.assessment_data.medications]
    : (row.current_medications ?? []),

  assessmentData: row.assessment_data || undefined,

  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapConsultationRequest = (row: any): ConsultationRequest => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patient_name,
  patientEmail: row.patient_email,
  patientPhone: row.patient_phone || undefined,
  doctorId: row.doctor_id,
  doctorName: row.doctor_name,
  doctorEmail: row.doctor_email,
  requestType: row.request_type,
  urgency: row.urgency,
  message: row.message || undefined,
  preferredConsultationMode: row.preferred_consultation_mode || undefined,
  status: row.status,
  requestedAt: row.requested_at,
  statusUpdatedAt: row.status_updated_at || row.requested_at,
  patientNotified: row.patient_notified,
  doctorNotified: row.doctor_notified,
  fullPatientProfile: row.full_patient_profile || undefined,
});

/* --------------------------------- queries -------------------------------- */

const currentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

// Doctor names are stored with their title (e.g. "Dr. Rajesh Kumar"), so guard
// against rendering "Dr. Dr. …" in patient-facing messages.
export const withDoctorTitle = (name: string): string =>
  /^\s*dr\.?\s/i.test(name || "") ? name : `Dr. ${name}`;

// Fetch the bookable doctor directory, best rated first.
//
// Only verified doctors are listed. The `doctors_select_directory` RLS policy
// already hides unverified practitioners from patients, but it deliberately
// lets a doctor read their own row so their dashboard works while pending —
// these filters keep that row out of the directory listing too.
export const fetchDoctors = async (): Promise<Doctor[]> => {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    .eq('license_verified', true);

  if (error) {
    console.error('Error in fetchDoctors:', error);
    throw new Error(`Failed to fetch doctors: ${error.message}`);
  }

  return (data ?? [])
    .map(mapDoctor)
    .sort((a, b) => {
      if (a.verificationPriority !== b.verificationPriority) {
        return a.verificationPriority - b.verificationPriority;
      }
      return (b.rating || 0) - (a.rating || 0);
    });
};

export const fetchPatientProfile = async (patientId: string): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching patient profile:', error);
    return null;
  }

  return data ? mapPatient(data) : null;
};

export const createConsultationRequest = async (
  requestData: CreateConsultationRequest
): Promise<string> => {
  const userId = await currentUserId();
  if (!userId) {
    throw new Error('User must be authenticated to create consultation request');
  }

  const patientProfile = await fetchPatientProfile(userId);
  if (!patientProfile) {
    throw new Error('Patient profile not found. Please complete your profile first.');
  }

  const { data: doctorRow, error: doctorError } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', requestData.doctorId)
    .maybeSingle();

  if (doctorError || !doctorRow) {
    throw new Error('Doctor not found or no longer available');
  }
  const doctorData = mapDoctor(doctorRow);

  // 1. Create the consultation request.
  const { data: inserted, error: insertError } = await supabase
    .from('consultation_requests')
    .insert({
      patient_id: userId,
      patient_name: patientProfile.name,
      patient_email: patientProfile.email,
      patient_phone: patientProfile.phoneNumber ?? null,

      doctor_id: requestData.doctorId,
      doctor_name: doctorData.name,
      doctor_email: doctorData.email,

      request_type: requestData.requestType,
      urgency: requestData.urgency,
      message: requestData.message?.trim() || null,
      preferred_consultation_mode: requestData.preferredConsultationMode ?? null,

      status: 'pending',
      patient_notified: false,
      doctor_notified: false,

      full_patient_profile: {
        name: patientProfile.name,
        email: patientProfile.email,
        age: patientProfile.age ?? null,
        gender: patientProfile.gender ?? null,
        phoneNumber: patientProfile.phoneNumber ?? null,
        address: patientProfile.address ?? null,
        bloodGroup: patientProfile.bloodGroup ?? null,
        emergencyContact: patientProfile.emergencyContact ?? null,
        medicalHistory: patientProfile.medicalHistory || [],
        allergies: patientProfile.allergies || [],
        currentMedications: patientProfile.currentMedications || [],
        assessmentData: patientProfile.assessmentData || null,
      },
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('Error creating consultation request:', insertError);

    // The database refuses requests against an unverified practitioner
    // (consultation_requests_require_verified_doctor). Say so plainly rather
    // than surfacing a Postgres error to the patient.
    if (insertError?.message?.includes('not a verified practitioner')) {
      throw new Error(
        `${doctorData.name} is not currently verified to accept consultation requests.`
      );
    }
    throw new Error(insertError?.message ?? 'Failed to create consultation request');
  }

  const requestId = inserted.id as string;

  // The doctor's pending counter is maintained by the
  // consultation_requests_bump_pending trigger. It used to be updated from
  // here, which RLS quietly refused — a patient cannot write another user's
  // doctors row — so the count never moved.

  // 2. Notify the patient that the request went out.
  const { error: notifyError } = await supabase.from('notifications').insert({
    user_id: userId,
    type: 'consultation_request_sent',
    title: 'Consultation Request Sent',
    message: `Your consultation request has been sent to ${withDoctorTitle(doctorData.name)}. You'll receive a response soon.`,
    doctor_id: requestData.doctorId,
    doctor_name: doctorData.name,
    request_id: requestId,
    read: false,
  });

  if (notifyError) {
    console.warn('Failed to create patient notification:', notifyError.message);
  }

  return requestId;
};

export const fetchPatientNotifications = async (): Promise<any[]> => {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  return data ?? [];
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) console.error('Error marking notification as read:', error);
};

export const fetchPatientConsultationRequests = async (): Promise<ConsultationRequest[]> => {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('consultation_requests')
    .select('*')
    .eq('patient_id', userId)
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('Error fetching patient consultation requests:', error);
    return [];
  }
  return (data ?? []).map(mapConsultationRequest);
};

// Raise a notification for any request whose status changed since last check.
export const checkForRequestUpdates = async (): Promise<void> => {
  const userId = await currentUserId();
  if (!userId) return;

  try {
    const requests = await fetchPatientConsultationRequests();

    const pending = requests.filter(
      (r) => (r.status === 'accepted' || r.status === 'rejected') && !r.patientNotified
    );
    if (pending.length === 0) return;

    const notifications = pending.map((request) => ({
      user_id: userId,
      type:
        request.status === 'accepted' ? 'consultation_accepted' : 'consultation_rejected',
      title:
        request.status === 'accepted'
          ? 'Consultation Request Accepted'
          : 'Consultation Request Update',
      message:
        request.status === 'accepted'
          ? `${withDoctorTitle(request.doctorName)} has accepted your consultation request!`
          : `${withDoctorTitle(request.doctorName)} is currently unavailable. Please try another doctor.`,
      doctor_id: request.doctorId,
      doctor_name: request.doctorName,
      request_id: request.id,
      read: false,
    }));

    const { error: notifyError } = await supabase.from('notifications').insert(notifications);
    if (notifyError) {
      console.error('Error creating status notifications:', notifyError);
      return;
    }

    // Only flag as notified once the notifications actually landed.
    const { error: flagError } = await supabase
      .from('consultation_requests')
      .update({ patient_notified: true })
      .in('id', pending.map((r) => r.id));

    if (flagError) console.error('Error flagging requests as notified:', flagError);
  } catch (error) {
    console.error('Error checking for request updates:', error);
  }
};

export const checkExistingRequest = async (doctorId: string): Promise<boolean> => {
  const userId = await currentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from('consultation_requests')
    .select('id')
    .eq('patient_id', userId)
    .eq('doctor_id', doctorId)
    .in('status', ['pending', 'accepted'])
    .limit(1);

  if (error) {
    console.error('Error checking existing request:', error);
    return false;
  }
  return (data ?? []).length > 0;
};

export const searchDoctors = async (searchTerm: string): Promise<Doctor[]> => {
  if (!searchTerm.trim()) {
    return fetchDoctors();
  }

  try {
    const allDoctors = await fetchDoctors();
    const searchLower = searchTerm.toLowerCase();

    return allDoctors.filter((doctor) => {
      return doctor.name.toLowerCase().includes(searchLower) ||
             doctor.clinicName?.toLowerCase().includes(searchLower) ||
             doctor.clinicAddress?.toLowerCase().includes(searchLower) ||
             doctor.ayurvedicSpecialization?.some((spec) =>
               spec.toLowerCase().includes(searchLower)
             );
    });
  } catch (error) {
    console.error('Error searching doctors:', error);
    throw new Error('Failed to search doctors');
  }
};

// Helper function to determine verification priority
const getVerificationPriority = (status: string): number => {
  switch (status) {
    case 'verified': return 1;
    case 'pending': return 2;
    case 'unverified': return 3;
    default: return 2;
  }
};
