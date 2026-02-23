import { NextRequest, NextResponse } from "next/server";
import { getBridgeQuote } from "@/lib/bridge";
import { config } from "@/lib/chains";

// GET /api/bridge?originChainId=10143&destinationChainId=1&originCurrency=0x...&destinationCurrency=0x...&amount=1000000&user=0x...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const originChainIdStr = searchParams.get("originChainId");
  const destinationChainIdStr = searchParams.get("destinationChainId");
  const originCurrency = searchParams.get("originCurrency");
  const destinationCurrency = searchParams.get("destinationCurrency");
  const amount = searchParams.get("amount");
  const user = searchParams.get("user");
  const recipient = searchParams.get("recipient") ?? undefined;

  if (
    !originChainIdStr ||
    !destinationChainIdStr ||
    !originCurrency ||
    !destinationCurrency ||
    !amount ||
    !user
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required params: originChainId, destinationChainId, originCurrency, destinationCurrency, amount, user",
        example: `/api/bridge?originChainId=${config.chainId}&destinationChainId=1&originCurrency=${config.usdc}&destinationCurrency=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&amount=1000000&user=0xYOUR_ADDRESS`,
      },
      { status: 400 }
    );
  }

  try {
    const quote = await getBridgeQuote({
      originChainId: parseInt(originChainIdStr, 10),
      destinationChainId: parseInt(destinationChainIdStr, 10),
      originCurrency,
      destinationCurrency,
      amount,
      user,
      recipient,
    });

    return NextResponse.json(quote);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Bridge quote failed",
        detail: err instanceof Error ? err.message : String(err),
        note: "Relay Protocol may not support all chain pairs. Check https://docs.relay.link for supported routes.",
      },
      { status: 502 }
    );
  }
}
