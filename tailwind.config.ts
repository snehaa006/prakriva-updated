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
        "2xl": "1200px",
      },
    },
    extend: {
      fontFamily: {
        // Body and UI copy.
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        // Headings. IM Fell DW Pica has one weight — src/index.css pins
        // `.font-display` to 400 so nothing asks the browser to fake a bold.
        display: [
          '"IM Fell DW Pica"',
          "Georgia",
          '"Times New Roman"',
          "serif",
        ],
        // Eyebrows, captions, pull quotes, figures — the small structural text.
        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        caption2: ["11px", { lineHeight: "13px", letterSpacing: "0.006em" }],
        caption1: ["12px", { lineHeight: "16px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        subhead: ["15px", { lineHeight: "20px" }],
        body: ["16px", { lineHeight: "24px" }],
        headline: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        title3: ["20px", { lineHeight: "26px", fontWeight: "600" }],
        title2: ["24px", { lineHeight: "30px", fontWeight: "700" }],
        title1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        "large-title": ["34px", { lineHeight: "41px", fontWeight: "700" }],
        // Fluid display sizes. Weight 400 throughout: these are always set in
        // IM Fell DW Pica, which only has a regular. They run a touch larger
        // than the old Playfair scale because the face has a small x-height.
        "display-sm": ["clamp(1.9rem,3.2vw,2.5rem)", { lineHeight: "1.18", fontWeight: "400" }],
        "display-md": ["clamp(2.4rem,4.8vw,3.6rem)", { lineHeight: "1.12", fontWeight: "400" }],
        "display-lg": ["clamp(2.8rem,6.6vw,5.2rem)", { lineHeight: "1.05", fontWeight: "400" }],
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
        gold: {
          DEFAULT: "hsl(var(--gold))",
          soft: "hsl(var(--gold-soft))",
          foreground: "hsl(var(--gold-foreground))",
        },
        vata: "hsl(var(--vata))",
        pitta: "hsl(var(--pitta))",
        kapha: "hsl(var(--kapha))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",

        // Remapped ramps — all existing class names keep working, they just
        // paint in the brand palette now.
        //
        // Three of the five brand colours sit within 20° of each other, so
        // these ramps are held apart by lightness and saturation as much as by
        // hue: `coral` runs consistently lighter than `rose`, `plum`
        // consistently darker. A tint alone is never the whole signal — see
        // the "binary states are filled vs. tinted" rule in the README.
        gray: {
          50: "hsl(29 40% 97%)",
          100: "hsl(29 32% 93%)",
          200: "hsl(29 24% 87%)",
          300: "hsl(29 18% 78%)",
          400: "hsl(45 10% 58%)",
          500: "hsl(48 10% 45%)",
          600: "hsl(52 12% 35%)",
          700: "hsl(55 16% 26%)",
          800: "hsl(58 20% 18%)",
          900: "hsl(58 23% 13%)",
          950: "hsl(58 24% 8%)",
        },
        slate: {
          50: "hsl(29 40% 97%)",
          100: "hsl(29 32% 93%)",
          200: "hsl(29 24% 87%)",
          300: "hsl(29 18% 78%)",
          400: "hsl(45 10% 58%)",
          500: "hsl(48 10% 45%)",
          600: "hsl(52 12% 35%)",
          700: "hsl(55 16% 26%)",
          800: "hsl(58 20% 18%)",
          900: "hsl(58 23% 13%)",
          950: "hsl(58 24% 8%)",
        },
        // Berry #A6465F again, under Tailwind's own name. The chat surfaces and
        // a couple of recipe badges reach for `pink-*` directly; remapping the
        // ramp brings all of them into the palette without touching 26 call
        // sites, and stops the default candy pink leaking through.
        pink: {
          50: "hsl(344 40% 96%)",
          100: "hsl(344 38% 92%)",
          200: "hsl(344 36% 85%)",
          300: "hsl(344 36% 73%)",
          400: "hsl(344 39% 60%)",
          500: "hsl(344 41% 51%)",
          600: "hsl(344 41% 46%)",
          700: "hsl(344 42% 37%)",
          800: "hsl(344 42% 29%)",
          900: "hsl(344 40% 22%)",
        },
        // Berry #A6465F — positive, on track, goal met.
        rose: {
          50: "hsl(344 40% 96%)",
          100: "hsl(344 38% 92%)",
          200: "hsl(344 36% 85%)",
          300: "hsl(344 36% 73%)",
          400: "hsl(344 39% 60%)",
          500: "hsl(344 41% 51%)",
          600: "hsl(344 41% 46%)",
          700: "hsl(344 42% 37%)",
          800: "hsl(344 42% 29%)",
          900: "hsl(344 40% 22%)",
        },
        // Brick #9B5152 — informational, emphasis, CTA glow. Deeper than
        // `rose` at every step so the two never read as the same tint.
        plum: {
          50: "hsl(359 32% 95%)",
          100: "hsl(359 30% 90%)",
          200: "hsl(359 30% 82%)",
          300: "hsl(359 30% 69%)",
          400: "hsl(359 31% 56%)",
          500: "hsl(359 31% 46%)",
          600: "hsl(359 32% 39%)",
          700: "hsl(359 33% 31%)",
          800: "hsl(359 33% 24%)",
          900: "hsl(359 32% 18%)",
        },
        // Dusty rose #B17A77 — attention, partial, needs a nudge. Lighter and
        // less saturated than `rose` at every step.
        coral: {
          50: "hsl(6 30% 96%)",
          100: "hsl(6 28% 92%)",
          200: "hsl(5 27% 86%)",
          300: "hsl(4 27% 76%)",
          400: "hsl(3 27% 64%)",
          500: "hsl(3 27% 58%)",
          600: "hsl(3 28% 48%)",
          700: "hsl(3 29% 39%)",
          800: "hsl(3 29% 30%)",
          900: "hsl(3 28% 23%)",
        },
      },
      // Sythra-style large rounded corners
      borderRadius: {
        none: "0px",
        sm: "6px",
        DEFAULT: "10px",
        md: "12px",
        lg: "16px",
        xl: "22px",
        "2xl": "28px",
        "3xl": "36px",
        full: "9999px",
      },
      // Shadows — warm-tinted, sythra-inspired depth
      // Shadows are cast in the olive (hsl 58 23% 15%) rather than in black, so
      // elevation over sand reads as warm depth instead of a grey haze.
      boxShadow: {
        xs: "0 1px 2px 0 hsl(58 23% 15% / 0.05)",
        sm: "0 2px 4px -1px hsl(58 23% 15% / 0.07), 0 1px 2px -1px hsl(58 23% 15% / 0.04)",
        DEFAULT: "0 2px 8px -2px hsl(58 23% 15% / 0.07), 0 1px 3px -1px hsl(58 23% 15% / 0.04)",
        md: "0 8px 24px -6px hsl(58 23% 15% / 0.11), 0 2px 6px -2px hsl(58 23% 15% / 0.05)",
        lg: "0 16px 48px -12px hsl(58 23% 15% / 0.15), 0 4px 12px -4px hsl(58 23% 15% / 0.06)",
        xl: "0 28px 80px -20px hsl(58 23% 15% / 0.20), 0 8px 24px -8px hsl(58 23% 15% / 0.07)",
        glass: "0 8px 32px hsl(58 23% 15% / 0.11)",
        glow: "0 0 24px -4px hsl(344 41% 46% / 0.25), 0 8px 20px -6px hsl(344 41% 46% / 0.12)",
        "glow-gold": "0 14px 32px hsl(344 41% 46% / 0.30), 0 0 0 1px hsl(344 41% 46% / 0.08)",
        lift: "0 28px 80px -20px hsl(58 23% 15% / 0.14), 0 8px 24px -8px hsl(58 23% 15% / 0.09)",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        "ios-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        DEFAULT: "250ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "draw-stroke": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.025)" },
        },
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
        "companion-think-bounce": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-4px) rotate(-5deg)" },
          "75%": { transform: "translateY(-2px) rotate(5deg)" },
        },
        "companion-celebrate": {
          "0%, 100%": { transform: "scale(1) rotate(0deg)" },
          "20%": { transform: "scale(1.1) rotate(-8deg)" },
          "40%": { transform: "scale(1.05) rotate(8deg)" },
          "60%": { transform: "scale(1.1) rotate(-4deg)" },
          "80%": { transform: "scale(1.05) rotate(4deg)" },
        },
        "message-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.99)" },
          to: { opacity: "1", transform: "none" },
        },
        "nudge-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.94)" },
          to: { opacity: "1", transform: "none" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "rise-in": "rise-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        "draw-stroke": "draw-stroke 1.2s cubic-bezier(0.65, 0, 0.35, 1) both",
        breathe: "breathe 5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-bob": "companion-bob 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-blink": "companion-blink 5.5s ease-in-out infinite",
        "companion-scan": "companion-scan 1.6s ease-in-out infinite",
        "companion-think": "companion-think 1.1s ease-in-out infinite",
        "companion-sparkle": "companion-sparkle 1.8s ease-in-out infinite",
        "companion-think-bounce": "companion-think-bounce 1s ease-in-out infinite",
        "companion-celebrate": "companion-celebrate 0.8s ease-in-out",
        "message-in": "message-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        "nudge-in": "nudge-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
        shimmer: "shimmer 2.5s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
