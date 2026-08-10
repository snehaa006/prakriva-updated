import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DoshaMeterProps {
  dosha: 'vata' | 'pitta' | 'kapha';
  value: number;
  label?: string;
  className?: string;
}

const DOSHA_INFO: Record<
  DoshaMeterProps["dosha"],
  { text: string; bg: string; bgSoft: string; name: string; description: string }
> = {
  vata: {
    text: "text-vata",
    bg: "bg-vata",
    bgSoft: "bg-vata/10",
    name: "Vata",
    description: "Air & space — movement, breathing, circulation",
  },
  pitta: {
    text: "text-pitta",
    bg: "bg-pitta",
    bgSoft: "bg-pitta/10",
    name: "Pitta",
    description: "Fire & water — digestion, metabolism, transformation",
  },
  kapha: {
    text: "text-kapha",
    bg: "bg-kapha",
    bgSoft: "bg-kapha/10",
    name: "Kapha",
    description: "Earth & water — structure, immunity, lubrication",
  },
};

export const DoshaMeter = ({ dosha, value, label, className }: DoshaMeterProps) => {
  const info = DOSHA_INFO[dosha];
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-subhead font-semibold",
          info.bgSoft,
          info.text,
        )}
        aria-hidden
      >
        {clamped}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className={cn("text-subhead font-semibold", info.text)}>{label || info.name}</h4>
          <span className="text-caption1 font-medium text-foreground-tertiary">{clamped}%</span>
        </div>
        <Progress value={clamped} className="h-2" indicatorClassName={info.bg} />
        <p className="text-caption1 text-foreground-tertiary">{info.description}</p>
      </div>
    </div>
  );
};
