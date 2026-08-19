import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "Inter",
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        caption2: ["11px", { lineHeight: "13px", letterSpacing: "0.006em" }],
        caption1: ["12px", { lineHeight: "16px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        subhead: ["15px", { lineHeight: "20px" }],
        body: ["17px", { lineHeight: "22px" }],
        headline: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        title3: ["20px", { lineHeight: "25px", fontWeight: "600" }],
        title2: ["22px", { lineHeight: "28px", fontWeight: "700" }],
        title1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        "large-title": ["34px", { lineHeight: "41px", fontWeight: "700" }],
      },
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        "background-elevated": "hsl(var(--background-elevated))",
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          secondary: "hsl(var(--foreground-secondary))",
          tertiary: "hsl(var(--foreground-tertiary))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: "hsl(var(--accent-soft))",
          "soft-foreground": "hsl(var(--accent-soft-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Ayurvedic dosha colors — domain-critical, kept distinct by hue
        // (violet/orange/green) rather than folded into the neutral+accent system.
        vata: "hsl(var(--vata))",
        pitta: "hsl(var(--pitta))",
        kapha: "hsl(var(--kapha))",
        // Status colors
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",

        // --- Muted ramps (re-tuned, not removed) --------------------------
        // ~30 files use these ramps hundreds of times (bg-rose-50, text-gray-600,
        // etc). Rather than migrating every call site, the ramps are kept and
        // their HSL values re-tuned to the neutral/single-accent iOS palette —
        // every existing class name keeps working, it just paints differently.
        //   gray/slate  neutral hue 340 — quiet neutrals, warmed a few percent
        //                                toward the accent so they sit on the
        //                                blush background instead of fighting it
        //   rose        accent hue 340 — positive / on-track (softened vs before)
        //   plum        hue 318        — informational (deep magenta-plum)
        //   coral       hue 12         — attention / needs a nudge (warm red)
        //
        // plum and coral are pulled to the same hues `src/lib/chartColors.ts`
        // uses (318 / 12), which its own test pins to within 40° of the brand
        // hue. They previously borrowed the *dosha* hues instead — violet 256
        // and orange 18 — which put a violet avatar and an orange notification
        // bell on the doctor dashboard, and quietly spent the vata/pitta
        // colours on things that have nothing to do with a dosha. Same ramp
        // names, same call sites; they just land back inside the palette.
        gray: {
          50: "hsl(340 30% 98%)",
          100: "hsl(340 22% 96%)",
          200: "hsl(340 16% 91%)",
          300: "hsl(340 12% 84%)",
          400: "hsl(340 8% 64%)",
          500: "hsl(340 6% 50%)",
          600: "hsl(340 7% 40%)",
          700: "hsl(340 8% 32%)",
          800: "hsl(340 9% 22%)",
          900: "hsl(340 10% 15%)",
          950: "hsl(340 12% 9%)",
        },
        slate: {
          50: "hsl(340 30% 98%)",
          100: "hsl(340 22% 96%)",
          200: "hsl(340 16% 91%)",
          300: "hsl(340 12% 84%)",
          400: "hsl(340 8% 64%)",
          500: "hsl(340 6% 50%)",
          600: "hsl(340 7% 40%)",
          700: "hsl(340 8% 32%)",
          800: "hsl(340 9% 22%)",
          900: "hsl(340 10% 15%)",
          950: "hsl(340 12% 9%)",
        },
        rose: {
          50: "hsl(340 45% 97%)",
          100: "hsl(340 42% 94%)",
          200: "hsl(340 38% 87%)",
          300: "hsl(340 34% 78%)",
          400: "hsl(340 32% 66%)",
          500: "hsl(340 40% 54%)",
          600: "hsl(340 42% 44%)",
          700: "hsl(340 40% 36%)",
          800: "hsl(340 38% 28%)",
          900: "hsl(340 36% 22%)",
        },
        plum: {
          50: "hsl(318 40% 97%)",
          100: "hsl(318 36% 94%)",
          200: "hsl(318 34% 87%)",
          300: "hsl(318 34% 78%)",
          400: "hsl(318 40% 66%)",
          500: "hsl(318 46% 54%)",
          600: "hsl(318 46% 44%)",
          700: "hsl(318 44% 36%)",
          800: "hsl(318 42% 28%)",
          900: "hsl(318 40% 22%)",
        },
        coral: {
          50: "hsl(12 55% 96%)",
          100: "hsl(12 52% 92%)",
          200: "hsl(12 50% 85%)",
          300: "hsl(12 48% 74%)",
          400: "hsl(12 48% 64%)",
          500: "hsl(12 50% 56%)",
          600: "hsl(12 55% 46%)",
          700: "hsl(12 52% 38%)",
          800: "hsl(12 48% 30%)",
          900: "hsl(12 44% 23%)",
        },
      },
      // Corners were 12/20/28/36px — soft enough that a card, a dialog and a
      // pill all read as the same lozenge, and large enough on a 200px card
      // that the radius competed with the content. Tightened to a scale where
      // each step is a distinguishable surface: chips stay pill-shaped, cards
      // are quietly rounded, and only genuinely large surfaces take a big
      // radius. `full` is unchanged, so buttons and avatars are untouched.
      borderRadius: {
        none: "0px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        full: "9999px",
      },
      // Shadows are cast in the warm neutral rather than a cool gray, so
      // elevation reads as depth instead of a gray haze over blush surfaces.
      boxShadow: {
        xs: "0 1px 2px 0 hsl(340 12% 12% / 0.04)",
        sm: "0 1px 3px 0 hsl(340 12% 12% / 0.06), 0 1px 2px -1px hsl(340 12% 12% / 0.04)",
        DEFAULT: "0 1px 3px 0 hsl(340 12% 12% / 0.06), 0 1px 2px -1px hsl(340 12% 12% / 0.04)",
        md: "0 4px 12px -2px hsl(340 12% 12% / 0.08), 0 2px 4px -2px hsl(340 12% 12% / 0.04)",
        lg: "0 12px 24px -4px hsl(340 12% 12% / 0.10), 0 4px 8px -4px hsl(340 12% 12% / 0.04)",
        xl: "0 24px 48px -8px hsl(340 12% 12% / 0.14), 0 8px 16px -8px hsl(340 12% 12% / 0.06)",
        glass: "0 8px 32px hsl(340 12% 12% / 0.10)",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        "ios-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        DEFAULT: "250ms",
      },
      // One small motion vocabulary, defined once here and used everywhere,
      // rather than a bespoke transition per component. All of it is switched
      // off by the `prefers-reduced-motion` block in src/index.css — motion is
      // decoration in this app, never the only way something is communicated.
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        // Content entering the page: a short rise, never a slide from off-screen.
        "rise-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Line-art illustrations draw themselves. Paths carry pathLength={1},
        // so one keyframe works for every path regardless of its real length.
        "draw-stroke": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        // A slow, shallow swell — used once, on the pregnancy illustration.
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.025)" },
        },
        // --- Chat companion -------------------------------------------------
        // The character in the chat panel (components/chat/CompanionCharacter)
        // is alive in a very small way: it breathes, it blinks, its eyes scan
        // while reading, and it thinks in dots. Every one of these is idle
        // decoration on a loop, so they are shallow and slow on purpose.
        "companion-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2.5px)" },
        },
        "companion-blink": {
          "0%, 90%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.12)" },
        },
        "companion-scan": {
          "0%, 100%": { transform: "translateX(-1.6px)" },
          "50%": { transform: "translateX(1.6px)" },
        },
        "companion-think": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.35" },
          "50%": { transform: "translateY(-2.5px)", opacity: "1" },
        },
        "companion-sparkle": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.65" },
          "50%": { transform: "scale(1.15)", opacity: "1" },
        },
        // A message, a suggestion chip or a card arriving in the transcript.
        "message-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.99)" },
          to: { opacity: "1", transform: "none" },
        },
        // The unprompted nudge that pops up beside the closed launcher.
        "nudge-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.94)" },
          to: { opacity: "1", transform: "none" },
        },
        // The three dots the assistant shows while an answer is on its way.
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "rise-in": "rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "draw-stroke": "draw-stroke 1.2s cubic-bezier(0.65, 0, 0.35, 1) both",
        breathe: "breathe 5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-bob": "companion-bob 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-blink": "companion-blink 5.5s ease-in-out infinite",
        "companion-scan": "companion-scan 1.6s ease-in-out infinite",
        "companion-think": "companion-think 1.1s ease-in-out infinite",
        "companion-sparkle": "companion-sparkle 1.8s ease-in-out infinite",
        "message-in": "message-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        "nudge-in": "nudge-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
