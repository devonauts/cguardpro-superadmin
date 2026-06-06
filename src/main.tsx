import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useHref, useNavigate } from "react-router-dom";
import { HeroUIProvider } from "@heroui/react";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles/globals.css";

// HeroUIProvider needs the router's navigate/useHref, so it lives inside Router.
function Providers({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </HeroUIProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* basename matches the deploy sub-path (vite `base`). */}
    <BrowserRouter basename="/superadmin">
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
    <Toaster richColors position="top-center" theme="dark" />
  </React.StrictMode>,
);
