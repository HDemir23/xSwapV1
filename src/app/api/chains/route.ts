import { NextResponse } from "next/server";
import { getSupportedChains } from "@/lib/chains";

// GET /api/chains — list all supported chains
export async function GET() {
  const chains = getSupportedChains().map((c) => ({
    chainId: c.chainId,
    name: c.name,
    nativeSymbol: c.nativeSymbol,
    explorer: c.explorer,
    rpc: c.rpc,
  }));

  return NextResponse.json({
    count: chains.length,
    chains,
  });
}
