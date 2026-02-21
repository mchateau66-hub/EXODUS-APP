// src/app/welcome/layout.tsx
import * as React from "react";
import { ThemeToggleFloating } from "@/components/ui/theme-toggle-floating";
import { PublicHeader } from "@/components/ui/header";

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <ThemeToggleFloating />
      <PublicHeader />
      {children}
    </div>
  );
}