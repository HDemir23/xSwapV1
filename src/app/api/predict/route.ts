import { NextRequest, NextResponse } from "next/server";
import { type Address } from "viem";
import { getQuote } from "@/lib/uniswap";
import { getChain, isChainSupported } from "@/lib/chains";

// GET /api/predict?tokenIn=0x...&tokenOut=0x...&amountIn=...&feeTier=3000&chainId=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tokenIn = searchParams.get("tokenIn") as Address | null;
  const tokenOut = searchParams.get("tokenOut") as Address | null;
  const amountInStr = searchParams.get("amountIn");
  const feeTierStr = searchParams.get("feeTier") ?? "3000";
  const chainIdStr = searchParams.get("chainId");

  if (!tokenIn || !tokenOut || !amountInStr) {
    return NextResponse.json(
      {
        error: "Missing required params: tokenIn, tokenOut, amountIn",
        example:
          "/api/predict?tokenIn=0xC02a...&tokenOut=0xA0b8...&amountIn=1000000000000000000&chainId=1",
      },
      { status: 400 }
    );
  }

  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined;
  if (chainId !== undefined && !isChainSupported(chainId)) {
    return NextResponse.json(
      { error: `Unsupported chainId: ${chainId}` },
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
    const chain = getChain(chainId);
    const result = await getQuote({ tokenIn, tokenOut, amountIn, feeTier, chainId });

    return NextResponse.json({
      tokenIn,
      tokenOut,
      amountIn: amountInStr,
      currentQuote: result.amountOutFormatted,
      method: result.method,
      prediction: {
        direction: "neutral",
        confidence: 0.5,
        priceImpactBps: 0,
        horizon: "5m",
        model: "stub-v0",
        note: "Prediction model not yet deployed. Returns neutral baseline.",
      },
      feeTier,
      chainId: chain.chainId,
      network: chain.name.toLowerCase(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Prediction failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
