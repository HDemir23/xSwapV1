import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "xclaw-swap — Monad Uniswap V3",
  description:
    "Bot swap router on Monad. Execute Uniswap V3 token swaps with 0.5% commission split calldata.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
