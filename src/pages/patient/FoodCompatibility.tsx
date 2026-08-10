import { useEffect, useRef } from "react";
import { Utensils } from "lucide-react";
import { FoodoscopeApiError, fetchFoodoscopePath } from "@/services/foodoscopeApi";

/**
 * Food Compatibility checker.
 *
 * The tool itself is the self-contained `public/mealCompatibility.html`
 * ("Food Compatibility Intelligence Engine" — Ayurvedic viruddha ahara, the
 * rules for incompatible food combinations). It predates the React app and has
 * no dependency on it, so rather than port ~2000 lines we surface it in-app in
 * an iframe, keeping the sidebar and layout around it. Vercel serves the file
 * from `public/` directly, so the catch-all SPA rewrite does not shadow it.
 *
 * That page has no bundler and no Supabase client, so it can't read the
 * `foodoscope_api_keys` pool the app rotates through — it shipped with a single
 * hardcoded key, and its food search broke as soon as that key expired. So the
 * page asks us instead: it posts `{ type: "foodoscope-request", id, path }` up
 * to this component, we call FoodOScope with the live key pool, and post the
 * JSON back as `{ type: "foodoscope-response", id, ok, data | status }`.
 */

/** Paths the embedded page is allowed to ask for — the two it actually uses. */
const ALLOWED_PATH_PREFIXES = ["/recipe-bytitle/", "/search-recipe/"];

interface FoodoscopeRequest {
  type: "foodoscope-request";
  id: number;
  path: string;
}

const isFoodoscopeRequest = (data: unknown): data is FoodoscopeRequest => {
  const msg = data as Partial<FoodoscopeRequest> | null;
  return (
    !!msg &&
    msg.type === "foodoscope-request" &&
    typeof msg.id === "number" &&
    typeof msg.path === "string"
  );
};

const FoodCompatibility = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only our own iframe, served from our own origin, gets to use the keys.
      if (event.origin !== window.location.origin) return;
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      if (!isFoodoscopeRequest(event.data)) return;

      const { id, path } = event.data;
      const reply = (payload: Record<string, unknown>) =>
        (event.source as Window | null)?.postMessage(
          { type: "foodoscope-response", id, ...payload },
          event.origin
        );

      if (!ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        reply({ ok: false, status: 400, error: `Path not allowed: ${path}` });
        return;
      }

      try {
        const data = await fetchFoodoscopePath(path);
        reply({ ok: true, data });
      } catch (error) {
        reply({
          ok: false,
          // 0 tells the page the request never got a verdict from FoodOScope,
          // so it's worth retrying with its own fallback key.
          status: error instanceof FoodoscopeApiError ? error.status ?? 0 : 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="flex-1 flex flex-col p-6 gap-4 h-full">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Utensils className="w-7 h-7" />
          Food Compatibility
        </h1>
        <p className="text-muted-foreground">
          Check Ayurvedic food-combination compatibility (viruddha ahara) — add
          the foods in a meal and see which pairings clash and why.
        </p>
      </div>

      <div className="flex-1 min-h-[70vh] rounded-lg border overflow-hidden bg-white">
        <iframe
          ref={iframeRef}
          src="/mealCompatibility.html"
          title="Food Compatibility Intelligence Engine"
          className="w-full h-full min-h-[70vh]"
        />
      </div>
    </div>
  );
};

export default FoodCompatibility;
