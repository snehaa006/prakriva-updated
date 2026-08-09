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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        // Ayurvedic dosha colors
        vata: "hsl(var(--vata))",
        pitta: "hsl(var(--pitta))",
        kapha: "hsl(var(--kapha))",
        // Status colors
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",

        // --- Brand ramps -------------------------------------------------
        // The app is pink end to end, so the off-brand Tailwind ramps
        // (green/blue/amber/…) are replaced by three pink-family ramps. Hues
        // sit ~30° apart so states stay tellable apart at a glance while
        // still reading as one palette on the warm cream background:
        //
        //   plum  318°  cool pink   — informational / neutral emphasis
        //   rose  345°  brand pink  — positive, on-track, goal met
        //   coral  12°  warm pink   — attention, partial, needs a nudge
        //
        // Lightness follows Tailwind's own curve, so a mechanical swap that
        // keeps the shade number (bg-green-100 → bg-rose-100) also keeps the
        // contrast the layout was built around. `destructive`/red is left on
        // its native hue (0°): it already sits inside this pink family and
        // carries the clinical "high risk" signal.
        plum: {
          50: "hsl(318 60% 96%)",
          100: "hsl(318 58% 92%)",
          200: "hsl(318 52% 84%)",
          300: "hsl(318 48% 74%)",
          400: "hsl(318 46% 64%)",
          500: "hsl(318 46% 54%)",
          600: "hsl(318 48% 42%)",
          700: "hsl(318 46% 34%)",
          800: "hsl(318 42% 27%)",
          900: "hsl(318 40% 21%)",
        },
        rose: {
          50: "hsl(345 60% 96%)",
          100: "hsl(345 58% 92%)",
          200: "hsl(345 52% 84%)",
          300: "hsl(345 48% 74%)",
          400: "hsl(345 46% 64%)",
          500: "hsl(345 46% 54%)",
          600: "hsl(345 48% 42%)",
          700: "hsl(345 46% 34%)",
          800: "hsl(345 42% 27%)",
          900: "hsl(345 40% 21%)",
        },
        // Tailwind's stock `gray`/`slate` are blue-tinted, which reads cold
        // against the warm cream background. These keep the same lightness
        // curve (so every existing text-gray-600 / bg-gray-50 keeps its
        // contrast) but tint the neutral toward the brand hue instead. The
        // class names stay honest — these are still neutrals, just warm ones.
        gray: {
          50: "hsl(345 20% 98%)",
          100: "hsl(345 18% 96%)",
          200: "hsl(345 15% 91%)",
          300: "hsl(345 12% 84%)",
          400: "hsl(345 10% 64%)",
          500: "hsl(345 9% 50%)",
          600: "hsl(345 10% 40%)",
          700: "hsl(345 12% 32%)",
          800: "hsl(345 14% 22%)",
          900: "hsl(345 16% 15%)",
          950: "hsl(345 18% 9%)",
        },
        slate: {
          50: "hsl(345 20% 98%)",
          100: "hsl(345 18% 96%)",
          200: "hsl(345 15% 91%)",
          300: "hsl(345 12% 84%)",
          400: "hsl(345 10% 64%)",
          500: "hsl(345 9% 50%)",
          600: "hsl(345 10% 40%)",
          700: "hsl(345 12% 32%)",
          800: "hsl(345 14% 22%)",
          900: "hsl(345 16% 15%)",
          950: "hsl(345 18% 9%)",
        },
        // Hue 8 rather than a truer orange, and saturation held high through
        // the dark end: at hue 12 / ~48% saturation the 600–800 steps went
        // brown-terracotta, which reads as a different palette rather than a
        // warm pink. Saturation is what keeps a dark warm hue looking pink.
        coral: {
          50: "hsl(8 70% 96%)",
          100: "hsl(8 66% 92%)",
          200: "hsl(8 62% 85%)",
          300: "hsl(8 58% 77%)",
          400: "hsl(8 58% 67%)",
          500: "hsl(8 60% 58%)",
          600: "hsl(8 62% 48%)",
          700: "hsl(8 60% 39%)",
          800: "hsl(8 56% 30%)",
          900: "hsl(8 52% 23%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
