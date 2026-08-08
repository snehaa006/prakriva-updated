import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useDoctorPatients,
  type DoctorPatient,
} from "@/hooks/useDoctorPatients";

interface PatientPickerProps {
  /** Currently selected patient UUID (`patients.id`), or null/"" for none. */
  value?: string | null;
  onSelect: (patient: DoctorPatient | null) => void;
  label?: string;
  placeholder?: string;
  /** Restrict the list to certain consultation statuses. */
  statuses?: readonly string[];
  className?: string;
  disabled?: boolean;
  /** Show a refresh button next to the combobox. */
  showRefresh?: boolean;
}

/**
 * Searchable dropdown over *the signed-in doctor's own patients only*.
 *
 * Free-text patient-ID inputs let a doctor type any id — including patients
 * that are not theirs, and the P001-style code where the database wants a UUID.
 * This component removes both problems: the list comes from the doctor's
 * consultation requests, it can be filtered by name or by patient code, and it
 * hands the caller the full record, UUID included.
 */
export const PatientPicker: React.FC<PatientPickerProps> = ({
  value,
  onSelect,
  label = "Patient",
  placeholder = "Search by name or patient ID…",
  statuses,
  className,
  disabled = false,
  showRefresh = true,
}) => {
  const [open, setOpen] = useState(false);
  const { patients, isLoading, isFetching, error, refetch } = useDoctorPatients({
    statuses,
  });

  const selected = useMemo(
    () => patients.find((patient) => patient.id === value) ?? null,
    [patients, value]
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-xs text-gray-500 uppercase tracking-wide">
          {label}
        </Label>
      )}

      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled || isLoading}
              className="flex-1 justify-between font-normal"
            >
              {isLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading your patients…
                </span>
              ) : selected ? (
                <span className="truncate">
                  {selected.name}{" "}
                  <span className="text-muted-foreground">({selected.code})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(itemValue, search) =>
                itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput placeholder="Search name or patient ID…" />
              <CommandList>
                <CommandEmpty>
                  {error
                    ? "Could not load your patients."
                    : "No matching patient in your list."}
                </CommandEmpty>
                <CommandGroup>
                  {patients.map((patient) => (
                    <CommandItem
                      key={patient.id}
                      // Both name and code are searchable because cmdk filters
                      // on this string.
                      value={`${patient.name} ${patient.code} ${patient.email}`}
                      onSelect={() => {
                        onSelect(patient.id === value ? null : patient);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          patient.id === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{patient.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {patient.code}
                          {patient.email ? ` • ${patient.email}` : ""}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {patient.requestStatus}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {showRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh patient list"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
        )}
      </div>

      {!isLoading && patients.length === 0 && !error && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          No patients yet — they appear here once a consultation request is
          accepted.
        </p>
      )}
    </div>
  );
};

export default PatientPicker;
