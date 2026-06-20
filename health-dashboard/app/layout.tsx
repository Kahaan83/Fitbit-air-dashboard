import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import Sidebar from "@/components/Sidebar";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fitbit Air Physiological Dashboard — Google Health Gateway",
  description: "Advanced physiological telemetry analytics using the Google Health API v4, delivering insights on HRV recovery, autonomic nervous system balance, and acute stress events.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
      </head>
      <body
        style={{
          margin: 0,
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
          WebkitFontSmoothing: "antialiased"
        }}
        suppressHydrationWarning
      >
        <Script
          id="theme-init-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('theme');
                var theme = saved === 'whoop' ? 'whoop' : 'premium';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
        <ClientLayout>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
              {children}
            </main>
          </div>
        </ClientLayout>
      </body>
    </html>
  );
}
