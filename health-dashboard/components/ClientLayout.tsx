"use client";

import React, { useState } from "react";
import Header from "./Header";
import SettingsModal from "./SettingsModal";
import ToastContainer from "./ToastContainer";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 bg-radial-glow font-sans">
      <ToastContainer />
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
export default ClientLayout;
