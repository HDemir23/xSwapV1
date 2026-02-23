"use client";

import { memo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

interface HeaderProps {
  activePage?: "swap" | "bridge" | "history" | "docs";
}

export const Header = memo(function Header({
  activePage = "swap",
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <Link href="/" className="header-brand">
          <span className="header-icon">⚡</span>
          <span className="header-title">xclaw</span>
        </Link>
      </div>
      <nav className="header-nav">
        <Link
          href="/"
          className={`nav-link ${activePage === "swap" ? "active" : ""}`}
        >
          Swap
        </Link>
        <Link
          href="/bridge"
          className={`nav-link ${activePage === "bridge" ? "active" : ""}`}
        >
          Bridge
        </Link>
        <Link
          href="/history"
          className={`nav-link ${activePage === "history" ? "active" : ""}`}
        >
          History
        </Link>
        <Link
          href="/docs"
          className={`nav-link ${activePage === "docs" ? "active" : ""}`}
        >
          Docs
        </Link>
      </nav>
      <div className="header-right">
        <ConnectButton />
      </div>
    </header>
  );
});
