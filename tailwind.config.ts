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
      // --- Motion curves -------------------------------------------------
      // One family, borrowed from how iOS moves things: everything decelerates
      // into place. `ios` is the workhorse — a strong ease-out that starts at
      // full speed and settles, which is what makes a transition read as
      // momentum rather than as a timer counting down. The old value here was
      // `cubic-bezier(0.25, 0.1, 0.25, 1)`, CSS `ease` under another name: it
      // accelerates *into* the middle of the move, so every hover and every
      // panel arrived with a small mechanical lurch.
      //
      // `ios-spring` is for things that appear — sheets, dialogs, the chat
      // panel — and carries a deliberately tiny overshoot (~3%). It used to be
      // `cubic-bezier(0.34, 1.56, 0.64, 1)`, a 56% overshoot, which is a
      // cartoon bounce on anything the size of a modal.
      //
      // `ios-in` is the mirror, for things leaving: they should accelerate
      // away rather than decelerate into nothing.
      transitionTimingFunction: {
        // Also the DEFAULT, so the ~110 call sites that write a bare
        // `transition-colors` or `transition-all` — with no `ease-*` beside
        // it — pick up the app's curve instead of Tailwind's stock
        // `cubic-bezier(0.4, 0, 0.2, 1)`. That one change is most of why the
        // app moves consistently now.
        DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)",
        ios: "cubic-bezier(0.22, 1, 0.36, 1)",
        // Softer and longer-tailed — for larger travel (panels, sheets, page
        // transitions) where the full ease-out would look abrupt at the start.
        "ios-smooth": "cubic-bezier(0.16, 1, 0.3, 1)",
        "ios-spring": "cubic-bezier(0.32, 1.06, 0.36, 1)",
        "ios-in": "cubic-bezier(0.4, 0, 1, 1)",
        // Symmetrical, for state that toggles both ways (switches, tabs).
        "ios-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      // A short scale, so durations are picked rather than defaulted. The
      // rule of thumb they encode: the smaller the element and the shorter
      // its travel, the faster it should be — a 2px hover lift at 300ms feels
      // like syrup, and a full-height sheet at 150ms feels like a jump cut.
      //
      // Every duration in the app is named here rather than written inline as
      // `duration-[320ms]`. Two reasons, one of them non-obvious:
      //
      //   * the same three or four numbers were being retyped across a dozen
      //     files, and a motion system with a dozen durations has none;
      //   * `tailwindcss-animate` teaches `duration-*` to set
      //     `animation-duration` as well as `transition-duration`, which makes
      //     an *arbitrary* value ambiguous — Tailwind resolves the ambiguity by
      //     emitting nothing at all, so `duration-[320ms]` silently produces no
      //     CSS. Named values are unambiguous and emit both.
      transitionDuration: {
        // A bare `transition-colors` gets 200ms rather than Tailwind's 150ms —
        // long enough to read as a fade, short enough that a menu row still
        // highlights the instant it is pointed at.
        DEFAULT: "200ms",
        // Press feedback — must land inside the same frame budget as the tap.
        press: "110ms",
        // Hover tints, icon nudges, small state flips.
        quick: "180ms",
        // Cards, dropdowns, popovers, chips.
        base: "260ms",
        // Something closing. Always shorter than the matching entrance: nobody
        // waits on a thing they have already dismissed.
        exit: "220ms",
        // A section folding away — accordion, collapsible.
        collapse: "240ms",
        // A rail folding — the sidebar's width.
        fold: "280ms",
        // A panel settling into place — dialogs, toasts.
        settle: "320ms",
        // Panels, sheets, drawers, route changes.
        panel: "380ms",
        // A bar filling, a photo zooming: motion that *is* the content.
        sweep: "420ms",
        // The one deliberately long one — the chat companion crossing its
        // strip. It is a walk, and a walk that takes 300ms is a twitch.
        stroll: "620ms",
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
          // 10px, not 12: the reveal should read as the content settling into
          // place, not as it travelling in from somewhere else.
          from: { opacity: "0", transform: "translate3d(0, 10px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        // Menus, popovers, dropdowns and selects: they grow out of their
        // trigger rather than appearing. The direction is carried entirely by
        // `transform-origin` (see src/lib/motion.ts), which is why there is no
        // translate here — one keyframe serves a surface opening in any of the
        // four directions, and none of them drift sideways on the way in.
        "surface-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Route changes. Deliberately tiny — 6px and a fade. A page that
        // slides a whole card-width on every navigation stops feeling fast.
        "page-in": {
          from: { opacity: "0", transform: "translate3d(0, 6px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
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
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -2.5px, 0)" },
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
        // The mascot still thinks and still celebrates — it just does it with
        // the amplitude of a person nodding rather than of a cartoon. The old
        // values (4px/5deg at 1s, 10% scale and 8deg of swing) drew the eye
        // away from the answer the character was delivering.
        "companion-think-bounce": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          "25%": { transform: "translate3d(0, -2.5px, 0) rotate(-3deg)" },
          "75%": { transform: "translate3d(0, -1.5px, 0) rotate(3deg)" },
        },
        "companion-celebrate": {
          // Decays instead of oscillating flat: each swing is smaller than the
          // last, which is how a real settling motion ends.
          "0%, 100%": { transform: "scale(1) rotate(0deg)" },
          "22%": { transform: "scale(1.05) rotate(-4deg)" },
          "45%": { transform: "scale(1.03) rotate(3deg)" },
          "68%": { transform: "scale(1.02) rotate(-1.5deg)" },
          "86%": { transform: "scale(1.01) rotate(0.5deg)" },
        },
        "message-in": {
          from: { opacity: "0", transform: "translate3d(0, 8px, 0) scale(0.99)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "nudge-in": {
          // 0.97, not 0.94: paired with the softened spring below, the popup
          // now arrives rather than pops.
          from: { opacity: "0", transform: "translate3d(0, 10px, 0) scale(0.97)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translate3d(0, 0, 0)", opacity: "0.4" },
          "30%": { transform: "translate3d(0, -3px, 0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -8px, 0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      // Durations here follow the same rule as the scale above: travel and
      // size set the duration. Entrances all use the ease-out family so they
      // decelerate into place; the looping ambient ones keep a symmetric
      // in-out curve, because a loop with an ease-out reads as a stutter.
      animation: {
        "accordion-down": "accordion-down 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
        "accordion-up": "accordion-up 0.22s cubic-bezier(0.4, 0, 1, 1)",
        "rise-in": "rise-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "surface-in": "surface-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "page-in": "page-in 0.38s cubic-bezier(0.16, 1, 0.3, 1) both",
        "draw-stroke": "draw-stroke 1.2s cubic-bezier(0.65, 0, 0.35, 1) both",
        breathe: "breathe 5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-bob": "companion-bob 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-blink": "companion-blink 5.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-scan": "companion-scan 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-think": "companion-think 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-sparkle": "companion-sparkle 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        // Slowed from 1s: the same gesture at a calmer tempo reads as thought
        // rather than as impatience.
        "companion-think-bounce": "companion-think-bounce 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "companion-celebrate": "companion-celebrate 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
        "message-in": "message-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both",
        "nudge-in": "nudge-in 0.42s cubic-bezier(0.32, 1.06, 0.36, 1) both",
        "typing-dot": "typing-dot 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-soft": "pulse-soft 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
