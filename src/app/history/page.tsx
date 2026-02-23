"use client";

import { Header } from "@/components/Header";
import { HistoryBox } from "@/components/HistoryBox";
import { SakuraLeaves } from "@/components/SakuraLeaves";

export default function HistoryPage() {
  return (
    <div className="page-container">
      <SakuraLeaves />
      <Header activePage="history" />
      <main className="main-history">
        <HistoryBox />
      </main>
    </div>
  );
}
