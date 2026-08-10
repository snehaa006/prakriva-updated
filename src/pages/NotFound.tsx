import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass rounded-2xl shadow-lg px-10 py-12 text-center max-w-sm">
        <h1 className="mb-4 text-large-title text-foreground">404</h1>
        <p className="mb-6 text-title3 font-normal text-muted-foreground">Oops! Page not found</p>
        <a
          href="/"
          className="text-body font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
