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
          soft: "hsl(var(--secondary))",
          "soft-foreground": "hsl(var(--secondary-foreground))",
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
        //   gray/slate  neutral        — true cool neutrals (was warm-pink-tinted)
        //   rose        accent hue 340 — positive / on-track (softened vs before)
        //   plum        vata hue 256   — informational (violet, matches dosha)
        //   coral       pitta hue 18   — attention / needs a nudge (matches dosha)
        gray: {
          50: "hsl(240 20% 98%)",
          100: "hsl(240 14% 96%)",
          200: "hsl(240 10% 91%)",
          300: "hsl(240 8% 84%)",
          400: "hsl(240 6% 64%)",
          500: "hsl(240 5% 50%)",
          600: "hsl(240 6% 40%)",
          700: "hsl(240 7% 32%)",
          800: "hsl(240 8% 22%)",
          900: "hsl(240 9% 15%)",
          950: "hsl(240 10% 9%)",
        },
        slate: {
          50: "hsl(240 20% 98%)",
          100: "hsl(240 14% 96%)",
          200: "hsl(240 10% 91%)",
          300: "hsl(240 8% 84%)",
          400: "hsl(240 6% 64%)",
          500: "hsl(240 5% 50%)",
          600: "hsl(240 6% 40%)",
          700: "hsl(240 7% 32%)",
          800: "hsl(240 8% 22%)",
          900: "hsl(240 9% 15%)",
          950: "hsl(240 10% 9%)",
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
          50: "hsl(256 40% 97%)",
          100: "hsl(256 36% 94%)",
          200: "hsl(256 32% 87%)",
          300: "hsl(256 28% 78%)",
          400: "hsl(256 26% 66%)",
          500: "hsl(256 32% 54%)",
          600: "hsl(256 34% 44%)",
          700: "hsl(256 32% 36%)",
          800: "hsl(256 30% 28%)",
          900: "hsl(256 28% 22%)",
        },
        coral: {
          50: "hsl(18 60% 96%)",
          100: "hsl(18 55% 92%)",
          200: "hsl(18 50% 84%)",
          300: "hsl(18 48% 74%)",
          400: "hsl(18 50% 62%)",
          500: "hsl(18 60% 52%)",
          600: "hsl(18 65% 44%)",
          700: "hsl(18 62% 36%)",
          800: "hsl(18 55% 28%)",
          900: "hsl(18 48% 22%)",
        },
      },
      borderRadius: {
        none: "0px",
        sm: "8px",
        DEFAULT: "12px",
        md: "14px",
        lg: "20px",
        xl: "28px",
        "2xl": "36px",
        full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 hsl(240 6% 10% / 0.04)",
        sm: "0 1px 3px 0 hsl(240 6% 10% / 0.06), 0 1px 2px -1px hsl(240 6% 10% / 0.04)",
        DEFAULT: "0 1px 3px 0 hsl(240 6% 10% / 0.06), 0 1px 2px -1px hsl(240 6% 10% / 0.04)",
        md: "0 4px 12px -2px hsl(240 6% 10% / 0.08), 0 2px 4px -2px hsl(240 6% 10% / 0.04)",
        lg: "0 12px 24px -4px hsl(240 6% 10% / 0.10), 0 4px 8px -4px hsl(240 6% 10% / 0.04)",
        xl: "0 24px 48px -8px hsl(240 6% 10% / 0.14), 0 8px 16px -8px hsl(240 6% 10% / 0.06)",
        glass: "0 8px 32px hsl(240 6% 10% / 0.10)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
