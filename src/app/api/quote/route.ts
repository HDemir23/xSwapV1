import { NextRequest, NextResponse } from "next/server";
import { type Address } from "viem";
import { getQuote } from "@/lib/uniswap";
import { config } from "@/lib/chains";

// GET /api/quote?tokenIn=0x...&tokenOut=0x...&amountIn=1000000000000000000&feeTier=3000
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tokenIn = searchParams.get("tokenIn") as Address | null;
  const tokenOut = searchParams.get("tokenOut") as Address | null;
  const amountInStr = searchParams.get("amountIn");
  const feeTierStr = searchParams.get("feeTier") ?? "3000";

  if (!tokenIn || !tokenOut || !amountInStr) {
    return NextResponse.json(
      {
        error: "Missing required params: tokenIn, tokenOut, amountIn",
        example:
          "/api/quote?tokenIn=0x760AfE...&tokenOut=0x534b2f...&amountIn=1000000000000000000",
      },
      { status: 400 }
    );
  }

  const feeTier = parseInt(feeTierStr, 10);
  if (![100, 500, 3000, 10000].includes(feeTier)) {
    return NextResponse.json(
      { error: "feeTier must be one of: 100, 500, 3000, 10000" },
      { status: 400 }
    );
  }

  let amountIn: bigint;
  try {
    amountIn = BigInt(amountInStr);
  } catch {
    return NextResponse.json(
      { error: "amountIn must be a valid integer string (in wei)" },
      { status: 400 }
    );
  }

  try {
    const result = await getQuote({ tokenIn, tokenOut, amountIn, feeTier });

    return NextResponse.json({
      tokenIn,
      tokenOut,
      amountIn: amountInStr,
      amountOut: result.amountOutFormatted,
      feeTier,
      quoterUsed: result.quoterUsed,
      fallback: result.fallback,
      method: result.method,
      priceImpactBps: 0,
      gasEstimate: result.gasEstimate.toString(),
      network: config.network,
      ...(result.method === "slot0" && {
        note: "Price computed from pool slot0 sqrtPriceX96 (off-chain math, no QuoterV2 needed)",
      }),
      ...(result.method === "none" && {
        warning:
          "QuoterV2 not available on this network — set UV3_QUOTER_TESTNET env to enable on-chain quotes",
      }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Quote failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
