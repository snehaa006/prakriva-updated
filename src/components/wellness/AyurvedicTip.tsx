import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, Sun, Droplets, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AyurvedicTipProps {
  title: string;
  description: string;
  category: 'nutrition' | 'lifestyle' | 'seasonal' | 'dosha';
  dosha?: 'vata' | 'pitta' | 'kapha';
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}

const CATEGORY_INFO: Record<
  AyurvedicTipProps["category"],
  { icon: typeof Leaf; label: string }
> = {
  nutrition: { icon: Leaf, label: "Nutrition" },
  lifestyle: { icon: Sun, label: "Lifestyle" },
  seasonal: { icon: Droplets, label: "Seasonal" },
  dosha: { icon: Moon, label: "Dosha" },
};

const DOSHA_TEXT: Record<NonNullable<AyurvedicTipProps["dosha"]>, string> = {
  vata: "text-vata",
  pitta: "text-pitta",
  kapha: "text-kapha",
};

export const AyurvedicTip = ({
  title,
  description,
  category,
  dosha,
  timeOfDay,
}: AyurvedicTipProps) => {
  const { icon: Icon, label } = CATEGORY_INFO[category];

  return (
    <Card className="transition-all duration-200 ease-ios hover:shadow-md">
      <CardContent className="flex gap-4 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-primary">
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-subhead font-semibold text-foreground">{title}</h3>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-caption2">
                {label}
              </Badge>
              {dosha && (
                <Badge variant="outline" className={cn("text-caption2 capitalize", DOSHA_TEXT[dosha])}>
                  {dosha}
                </Badge>
              )}
              {timeOfDay && (
                <Badge variant="outline" className="text-caption2 capitalize">
                  {timeOfDay}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-footnote leading-relaxed text-foreground-secondary">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
};
