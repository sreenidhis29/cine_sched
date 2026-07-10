import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineSched | Agentic Film Scheduling",
  description: "AI-powered film production scheduling platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased bg-background text-on-surface">
        {children}
      </body>
    </html>
  );
}
