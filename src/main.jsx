import React from "react";
import { createRoot } from "react-dom/client";
import { AuthRoot } from "./AuthRoot.jsx";
import "./index.css";

const DynamicProvider = React.lazy(() => import("./DynamicProvider.jsx"));

const app = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID ? (
  <React.Suspense
    fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#12100e] text-xs text-amber-300 font-mono">
        Connecting to Dynamic Wallet...
      </div>
    }
  >
    <DynamicProvider>
      <AuthRoot />
    </DynamicProvider>
  </React.Suspense>
) : (
  <AuthRoot />
);

createRoot(document.getElementById("root")).render(<React.StrictMode>{app}</React.StrictMode>);
