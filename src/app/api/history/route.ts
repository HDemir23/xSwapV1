import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getWalletSwapHistory } from "@/lib/history";

// GET /api/history?address=0x...&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const address = searchParams.get("address");
  const limitStr = searchParams.get("limit") ?? "20";

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      {
        error: "address param must be a valid EVM address",
        example: "/api/history?address=0xYOUR_ADDRESS&limit=20",
      },
      { status: 400 }
    );
  }

  const limit = Math.min(parseInt(limitStr, 10) || 20, 100);

  try {
    const swaps = await getWalletSwapHistory(address as Address, limit);

    return NextResponse.json({
      address,
      count: swaps.length,
      limit,
      swaps,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "History fetch failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
