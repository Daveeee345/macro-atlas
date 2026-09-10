import type { Metadata } from "next";
import "./globals.css";
import "./terminal.css";
import "./evolution.css";

export const metadata: Metadata = {
  title: "Macro Atlas",
  description: "Global macroeconomic state & divergence intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
