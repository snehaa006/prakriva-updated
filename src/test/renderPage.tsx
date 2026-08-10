import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Render a page with the providers it needs in the real app.
 *
 * Pages load their data through react-query (`useCachedPageData`), so they
 * need a client in scope. Each call gets a **fresh** one: the cache is what
 * makes a returning page render instantly in production, and sharing it
 * between tests would let one test's data satisfy the next test's query.
 *
 * Retries are off so a deliberately failing fetch fails once, immediately,
 * rather than after react-query's backoff.
 */
export const renderPage = (ui: ReactElement, { route = "/" }: { route?: string } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return { queryClient, ...render(ui, { wrapper }) };
};

export default renderPage;
