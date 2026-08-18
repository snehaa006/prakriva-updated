import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTheme } from "@/lib/theme";
import "./index.css";

// Before the first render, so a dark-mode user never sees a white flash.
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
