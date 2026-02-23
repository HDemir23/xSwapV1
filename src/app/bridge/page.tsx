"use client";

import { Header } from "@/components/Header";
import { BridgeBox } from "@/components/BridgeBox";
import { SakuraLeaves } from "@/components/SakuraLeaves";

export default function BridgePage() {
  return (
    <div className="page-container">
      <SakuraLeaves />
      <Header activePage="bridge" />
      <main className="main-centered">
        <BridgeBox />
      </main>
    </div>
  );
}
