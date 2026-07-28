import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AccountFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AccountFieldsProps {
  values: AccountFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Sign-in only needs email + password. */
  isSignup: boolean;
  disabled?: boolean;
  namePlaceholder?: string;
  /** Doctors mark every field required with a `*`. */
  markRequired?: boolean;
}

/**
 * Name / email / password / confirm-password. Shared by the patient form and
 * step 1 of the doctor signup so the two cannot drift apart.
 */
const AccountFields = ({
  values,
  onChange,
  isSignup,
  disabled = false,
  namePlaceholder = "Enter your full name",
  markRequired = false,
}: AccountFieldsProps) => {
  const mark = markRequired ? " *" : "";

  return (
    <div className="space-y-4">
      {isSignup && (
        <div>
          <Label htmlFor="name">{`Full Name${mark}`}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            value={values.name}
            onChange={onChange}
            required
            placeholder={namePlaceholder}
            disabled={disabled}
          />
        </div>
      )}

      <div>
        <Label htmlFor="email">{`Email${mark}`}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={onChange}
          required
          placeholder={markRequired ? "john.doe@example.com" : "Enter your email"}
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor="password">{`Password${mark}`}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={values.password}
          onChange={onChange}
          required
          placeholder="Enter your password"
          disabled={disabled}
          minLength={6}
        />
      </div>

      {isSignup && (
        <div>
          <Label htmlFor="confirmPassword">{`Confirm Password${mark}`}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={values.confirmPassword}
            onChange={onChange}
            required
            placeholder="Confirm your password"
            disabled={disabled}
            minLength={6}
          />
        </div>
      )}
    </div>
  );
};

export default AccountFields;
