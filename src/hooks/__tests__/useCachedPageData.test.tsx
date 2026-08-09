import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCachedPageData } from "../useCachedPageData";

/**
 * The bug this hook exists for: every page kept its own `isLoading`, starting
 * at `true` on each mount, so *switching tabs* — not just the first visit —
 * covered data that had been on screen a second earlier with a spinner, and
 * refetched it. Routing unmounts the page, so the fix has to live outside it.
 */

const Page = ({ load }: { load: () => Promise<string> }) => {
  const { data, isFirstLoad, isRefreshing } = useCachedPageData(["page", "u1"], load);

  if (isFirstLoad) return <p>loading…</p>;
  return (
    <p>
      {data} {isRefreshing ? "(refreshing)" : "(settled)"}
    </p>
  );
};

/** One client across both renders, exactly as the app has one at its root. */
const renderTwice = async (load: () => Promise<string>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const first = render(<Page load={load} />, { wrapper });
  await screen.findByText(/circles/);
  first.unmount(); // navigating away

  return render(<Page load={load} />, { wrapper });
};

describe("useCachedPageData", () => {
  it("shows the spinner on the first visit only", async () => {
    const load = vi.fn(async () => "8 circles");

    const { container } = await renderTwice(load);

    // The remount paints the cached answer in its first frame — no spinner at
    // all, which is the whole point.
    expect(container.textContent).toContain("8 circles");
    expect(screen.queryByText("loading…")).not.toBeInTheDocument();
  });

  it("does not re-fetch inside the stale window", async () => {
    const load = vi.fn(async () => "8 circles");

    await renderTwice(load);

    await waitFor(() => expect(screen.getByText(/settled/)).toBeInTheDocument());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("treats a query that has not started as still loading", async () => {
    // Pages disable the query while the signed-in user id resolves; rendering
    // them empty for that beat is the same flicker the cache prevents.
    const Gated = () => {
      const { isFirstLoad } = useCachedPageData(["gated"], async () => "x", {
        enabled: false,
      });
      return <p>{isFirstLoad ? "loading…" : "ready"}</p>;
    };

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Gated />
      </QueryClientProvider>
    );

    expect(screen.getByText("loading…")).toBeInTheDocument();
  });
});
