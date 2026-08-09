import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Leaf,
  Shield,
  Star,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import AccountFields, { type AccountFormData } from "./AccountFields";
import {
  CONDITION_OPTIONS,
  CONSULTATION_MODE_OPTIONS,
  LANGUAGE_OPTIONS,
  SPECIALIZATION_OPTIONS,
} from "./doctorProfileOptions";
import {
  MEDICAL_COUNCILS,
  MEDICAL_DEGREES,
  MOCK_LICENSE_REGISTRY,
  calculateVerificationScore,
  getLicenseFormatHint,
  getVerificationBadge,
  type DoctorVerificationData,
  type VerificationBadgeTone,
  type VerificationResult,
} from "@/lib/licenseVerification";

const BADGE_ICONS: Record<VerificationBadgeTone, typeof Shield> = {
  expert: Shield,
  verified: Star,
  license: CheckCircle,
  pending: AlertTriangle,
  required: XCircle,
};

interface CheckboxGridProps {
  options: string[];
  selected: string[];
  columns: 1 | 2;
  onToggle: (value: string, checked: boolean) => void;
}

/** A labelled multi-select rendered as a grid of checkboxes. */
const CheckboxGrid = ({ options, selected, columns, onToggle }: CheckboxGridProps) => (
  <div className={`grid ${columns === 1 ? "grid-cols-1" : "grid-cols-2"} gap-2 mt-2`}>
    {options.map((option) => (
      <div key={option} className="flex items-center space-x-2">
        <Checkbox
          id={option}
          checked={selected.includes(option)}
          onCheckedChange={(checked) => onToggle(option, checked as boolean)}
        />
        <Label htmlFor={option} className="text-sm">
          {option}
        </Label>
      </div>
    ))}
  </div>
);

/**
 * The mocked registry has no public directory, so the numbers that resolve are
 * listed inline. Drop this once verification talks to a real council API.
 *
 * Clearing this check does not make an account verified — it only records the
 * claim. A human still has to approve the doctor server-side.
 */
const TestDoctorIds = () => (
  <Alert className="mb-4 border-plum-200 bg-plum-50">
    <AlertTriangle className="w-4 h-4" />
    <AlertDescription>
      <div className="text-sm">
        <p className="font-medium text-plum-700 mb-2">Test Doctor License Numbers:</p>
        <div className="grid grid-cols-1 gap-1 text-plum-600 text-xs">
          {Object.entries(MOCK_LICENSE_REGISTRY).map(([number, entry]) => (
            <div key={number}>
              <code>{number}</code> - {entry.doctorName}
              {!entry.isValid && (
                <span className="textplum-500"> (rejected: {entry.status})</span>
              )}
            </div>
          ))}
        </div>
        <p className="textplum-500 text-xs mt-2">
          Passing this check records your claim only. Your account stays pending
          until it is verified.
        </p>
      </div>
    </AlertDescription>
  </Alert>
);

interface DoctorSignupStepsProps {
  step: number;
  formData: AccountFormData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  verificationData: DoctorVerificationData;
  onVerificationChange: (field: keyof DoctorVerificationData, value: unknown) => void;
  onArrayFieldChange: (
    field: keyof DoctorVerificationData,
    value: string,
    checked: boolean
  ) => void;
  onVerifyLicense: () => void;
  isVerifyingLicense: boolean;
  verificationResult: VerificationResult | null;
  isLoading: boolean;
}

/** Steps of the doctor signup wizard: account, license, expertise, practice. */
const DoctorSignupSteps = ({
  step,
  formData,
  onFormChange,
  verificationData,
  onVerificationChange,
  onArrayFieldChange,
  onVerifyLicense,
  isVerifyingLicense,
  verificationResult,
  isLoading,
}: DoctorSignupStepsProps) => {
  switch (step) {
    case 1:
      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <p className="text-sm text-gray-600">Let's start with your basic details</p>
          </div>
          <AccountFields
            values={formData}
            onChange={onFormChange}
            isSignup
            disabled={isLoading}
            namePlaceholder="Dr. John Doe"
            markRequired
          />
        </div>
      );

    case 2:
      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              License Verification
            </h3>
            <p className="text-sm text-gray-600">Verify your medical credentials</p>
          </div>

          <TestDoctorIds />

          <div>
            <Label htmlFor="medicalCouncil">Medical Council *</Label>
            <Select
              value={verificationData.medicalCouncil}
              onValueChange={(value) => onVerificationChange("medicalCouncil", value)}
            >
              <SelectTrigger id="medicalCouncil">
                <SelectValue placeholder="Select your medical council" />
              </SelectTrigger>
              <SelectContent>
                {MEDICAL_COUNCILS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="licenseNumber">Medical License Number *</Label>
            <div className="flex gap-2">
              <Input
                id="licenseNumber"
                value={verificationData.licenseNumber}
                onChange={(e) =>
                  onVerificationChange("licenseNumber", e.target.value.toUpperCase())
                }
                placeholder="e.g., MH12345678"
                required
                disabled={isVerifyingLicense}
              />
              <Button
                type="button"
                onClick={onVerifyLicense}
                disabled={
                  !verificationData.licenseNumber ||
                  !verificationData.medicalCouncil ||
                  isVerifyingLicense
                }
                className="whitespace-nowrap"
              >
                {isVerifyingLicense ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Verify
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {getLicenseFormatHint(verificationData.medicalCouncil)}
            </p>
          </div>

          {verificationResult && (
            <Alert
              className={
                verificationResult.isValid
                  ? "border-rose-200 bg-rose-50"
                  : "border-red-200 bg-red-50"
              }
            >
              <div className="flex items-start gap-2">
                {verificationResult.isValid ? (
                  <CheckCircle className="w-4 h-4 text-rose-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    {verificationResult.isValid ? (
                      <div>
                        <p className="font-medium text-rose-700">
                          License Verified Successfully
                        </p>
                        <div className="mt-2 text-sm text-rose-600">
                          <p>
                            <strong>Doctor:</strong> {verificationResult.doctorName}
                          </p>
                          <p>
                            <strong>Registration:</strong> {verificationResult.registrationDate}
                          </p>
                          <p>
                            <strong>Status:</strong> {verificationResult.status?.toUpperCase()}
                          </p>
                          <p>
                            <strong>Council:</strong> {verificationResult.council}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-red-700">License Verification Failed</p>
                        <p className="text-sm text-red-600 mt-1">{verificationResult.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <div>
            <Label htmlFor="medicalDegree">Medical Degree *</Label>
            <Select
              value={verificationData.medicalDegree}
              onValueChange={(value) => onVerificationChange("medicalDegree", value)}
            >
              <SelectTrigger id="medicalDegree">
                <SelectValue placeholder="Select your degree" />
              </SelectTrigger>
              <SelectContent>
                {MEDICAL_DEGREES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="graduationYear">Graduation Year *</Label>
            <Input
              id="graduationYear"
              type="number"
              min="1980"
              max={new Date().getFullYear()}
              value={verificationData.graduationYear}
              onChange={(e) => onVerificationChange("graduationYear", e.target.value)}
              placeholder="2020"
              required
            />
          </div>
        </div>
      );

    case 3:
      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
              <Leaf className="w-5 h-5" />
              Ayurvedic Expertise
            </h3>
            <p className="text-sm text-gray-600">
              Tell us about your Ayurvedic specialization
            </p>
          </div>

          <div>
            <Label htmlFor="ayurvedicCertification">Ayurvedic Certification</Label>
            <Input
              id="ayurvedicCertification"
              value={verificationData.ayurvedicCertification}
              onChange={(e) => onVerificationChange("ayurvedicCertification", e.target.value)}
              placeholder="Certificate in Ayurvedic Nutrition"
            />
          </div>

          <div>
            <Label>Specialization Areas</Label>
            <CheckboxGrid
              options={SPECIALIZATION_OPTIONS}
              selected={verificationData.ayurvedicSpecialization}
              columns={2}
              onToggle={(value, checked) =>
                onArrayFieldChange("ayurvedicSpecialization", value, checked)
              }
            />
          </div>

          <div>
            <Label htmlFor="traditionalTraining">Traditional Training Background</Label>
            <Textarea
              id="traditionalTraining"
              value={verificationData.traditionalTraining}
              onChange={(e) => onVerificationChange("traditionalTraining", e.target.value)}
              placeholder="Describe your traditional Ayurvedic training, mentors, institutions..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="yearsOfExperience">Years of Experience *</Label>
            <Input
              id="yearsOfExperience"
              type="number"
              min="0"
              max="50"
              value={verificationData.yearsOfExperience}
              onChange={(e) => onVerificationChange("yearsOfExperience", e.target.value)}
              placeholder="5"
              required
            />
          </div>
        </div>
      );

    case 4: {
      const score = calculateVerificationScore(verificationData);
      const badge = getVerificationBadge(score, verificationData.licenseVerified);
      const BadgeIcon = BADGE_ICONS[badge.tone];

      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">Practice Details</h3>
            <p className="text-sm text-gray-600">Complete your professional profile</p>
          </div>

          <div>
            <Label htmlFor="clinicName">Clinic/Practice Name *</Label>
            <Input
              id="clinicName"
              value={verificationData.clinicName}
              onChange={(e) => onVerificationChange("clinicName", e.target.value)}
              placeholder="Ayurvedic Wellness Center"
              required
            />
          </div>

          <div>
            <Label htmlFor="clinicAddress">Clinic Address</Label>
            <Textarea
              id="clinicAddress"
              value={verificationData.clinicAddress}
              onChange={(e) => onVerificationChange("clinicAddress", e.target.value)}
              placeholder="Complete address of your practice"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="consultationFee">Consultation Fee (₹)</Label>
            <Input
              id="consultationFee"
              type="number"
              min="0"
              value={verificationData.consultationFee}
              onChange={(e) => onVerificationChange("consultationFee", e.target.value)}
              placeholder="500"
            />
          </div>

          <div>
            <Label>Languages Spoken</Label>
            <CheckboxGrid
              options={LANGUAGE_OPTIONS}
              selected={verificationData.languages}
              columns={2}
              onToggle={(value, checked) => onArrayFieldChange("languages", value, checked)}
            />
          </div>

          <div>
            <Label>Special Conditions Treated</Label>
            <CheckboxGrid
              options={CONDITION_OPTIONS}
              selected={verificationData.specialConditions}
              columns={1}
              onToggle={(value, checked) =>
                onArrayFieldChange("specialConditions", value, checked)
              }
            />
          </div>

          <div>
            <Label>Consultation Modes Available</Label>
            <CheckboxGrid
              options={CONSULTATION_MODE_OPTIONS}
              selected={verificationData.consultationModes}
              columns={2}
              onToggle={(value, checked) =>
                onArrayFieldChange("consultationModes", value, checked)
              }
            />
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="font-medium mb-3">Profile Verification Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Verification Score:</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-plum-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{score}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={`${badge.color} text-white`}>
                  <BadgeIcon className="w-3 h-3 mr-1" />
                  {badge.text}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
};

export default DoctorSignupSteps;
