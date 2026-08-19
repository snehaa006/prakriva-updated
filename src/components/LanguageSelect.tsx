// The language picker, in two shapes: a full-width select for Settings and a
// compact globe button for the app header.
//
// Both write to the same place (`I18nContext`), so changing the language
// anywhere changes it everywhere, immediately, on whatever page the user is
// looking at.

import { useState } from "react";
import { Check, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import type { LanguageCode, LanguageOption } from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Language names are shown in their own script — never machine-translated. */
const NO_TRANSLATE = { translate: "no" as const, className: "notranslate" };

const byGroup = (languages: LanguageOption[]) => ({
  India: languages.filter((l) => l.group === "India"),
  International: languages.filter((l) => l.group === "International"),
});

export function LanguageSelect({ className }: { className?: string }) {
  const { language, setLanguage, languages, isTranslating } = useTranslation();
  const groups = byGroup(languages);

  return (
    <div className={cn("space-y-2", className)}>
      <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
        <SelectTrigger {...NO_TRANSLATE}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent {...NO_TRANSLATE}>
          {(Object.keys(groups) as Array<keyof typeof groups>).map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {groups[group].map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                  {option.label !== option.englishLabel && (
                    <span className="text-muted-foreground"> · {option.englishLabel}</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {isTranslating && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Translating this page…
        </p>
      )}
    </div>
  );
}

/**
 * Header version: a globe that opens the same list. Present on every screen so
 * the language can be changed without first finding Settings.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, languages, isTranslating } = useTranslation();
  const [open, setOpen] = useState(false);
  const groups = byGroup(languages);
  const current = languages.find((l) => l.code === language);

  const choose = (code: LanguageCode) => {
    setLanguage(code);
    // This project's menu items don't close the menu themselves, so the open
    // state is driven from here.
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 gap-1.5 px-2 text-xs font-medium", className)}
          aria-label="Change language"
        >
          {isTranslating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="notranslate hidden sm:inline" translate="no">
            {current?.label ?? "English"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notranslate max-h-80 overflow-y-auto" translate="no">
        {(Object.keys(groups) as Array<keyof typeof groups>).map((group, index) => (
          <div key={group}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {group}
            </DropdownMenuLabel>
            {groups[group].map((option) => (
              <DropdownMenuItem
                key={option.code}
                onClick={() => choose(option.code)}
                className="gap-2"
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    option.code === language ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>{option.label}</span>
                {option.label !== option.englishLabel && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {option.englishLabel}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelect;
