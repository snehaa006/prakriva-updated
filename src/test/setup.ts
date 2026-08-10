import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// src/lib/supabase.ts throws at import time when these are unset. Tests that
// touch Supabase mock the module outright, but anything that pulls it in
// transitively still needs the import to succeed.
process.env.VITE_SUPABASE_URL ??= "https://test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";

afterEach(() => {
  cleanup();
});

// --- jsdom gaps that Radix UI primitives rely on ---------------------------
// Radix measures and captures pointers; jsdom implements none of this, so the
// Select/Checkbox primitives throw without these shims.

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Dialog/AlertDialog/Sheet/Drawer are built on the native <dialog> element,
// which jsdom renders but does not give showModal/close. Without these the
// overlays throw as soon as they open.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.show) {
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.setPointerCapture ??= vi.fn();
Element.prototype.releasePointerCapture ??= vi.fn();
