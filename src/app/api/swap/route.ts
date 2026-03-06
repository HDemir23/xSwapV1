import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getQuote, buildSwapCalldata } from "@/lib/uniswap";
import { getChain, isChainSupported } from "@/lib/chains";

// POST /api/swap
// Body: {
//   tokenIn: string,
//   tokenOut: string,
//   amountIn: string,
//   feeTier?: number,       // default 3000
//   recipient: string,
//   slippageBps?: number,   // default 100 (1%)
//   chainId?: number,       // default: DEFAULT_CHAIN_ID
// }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    tokenIn,
    tokenOut,
    amountIn: amountInRaw,
    feeTier: feeTierRaw,
    recipient: recipientRaw,
    slippageBps: slippageBpsRaw,
    chainId: chainIdRaw,
    isNativeIn: isNativeInRaw,
  } = body;

  const isNativeIn = Boolean(isNativeInRaw);

  // Validate chainId
  const chainId = chainIdRaw !== undefined ? Number(chainIdRaw) : undefined;
  if (chainId !== undefined && !isChainSupported(chainId)) {
    return NextResponse.json(
      { error: `Unsupported chainId: ${chainId}` },
      { status: 400 }
    );
  }

  // Validate
  if (!tokenIn || typeof tokenIn !== "string" || !isAddress(tokenIn)) {
    return NextResponse.json(
      { error: "tokenIn must be a valid EVM address" },
      { status: 400 }
    );
  }
  if (!tokenOut || typeof tokenOut !== "string" || !isAddress(tokenOut)) {
    return NextResponse.json(
      { error: "tokenOut must be a valid EVM address" },
      { status: 400 }
    );
  }
  if (!recipientRaw || typeof recipientRaw !== "string" || !isAddress(recipientRaw)) {
    return NextResponse.json(
      { error: "recipient must be a valid EVM address" },
      { status: 400 }
    );
  }

  const payToAddress = process.env.PAY_TO_ADDRESS;
  if (!payToAddress || !isAddress(payToAddress)) {
    return NextResponse.json(
      { error: "Server misconfigured: PAY_TO_ADDRESS env not set" },
      { status: 500 }
    );
  }

  let amountIn: bigint;
  try {
    amountIn = BigInt(String(amountInRaw));
  } catch {
    return NextResponse.json(
      { error: "amountIn must be a valid integer string (in wei)" },
      { status: 400 }
    );
  }

  const feeTier = Number(feeTierRaw ?? 3000);
  if (![100, 500, 3000, 10000].includes(feeTier)) {
    return NextResponse.json(
      { error: "feeTier must be one of: 100, 500, 3000, 10000" },
      { status: 400 }
    );
  }

  const slippageBps = Number(slippageBpsRaw ?? 100); // default 1%
  const chain = getChain(chainId);

  // Get quote for amountOutMinimum (after commission, swap uses 99.5%)
  const feeBps = 50n;
  const feeAmount = (amountIn * feeBps) / 10000n;
  const swapAmount = amountIn - feeAmount;

  let amountOutMinimum = 0n;
  try {
    const quote = await getQuote({
      tokenIn: tokenIn as Address,
      tokenOut: tokenOut as Address,
      amountIn: swapAmount,
      feeTier,
      chainId,
    });
    if (quote.quoterUsed && quote.amountOut > 0n) {
      // Apply slippage tolerance
      amountOutMinimum =
        (quote.amountOut * BigInt(10000 - slippageBps)) / 10000n;
    }
  } catch {
    // If quote fails, use 0 minimum (bot accepts any amount out)
    amountOutMinimum = 0n;
  }

  const calldata = buildSwapCalldata({
    tokenIn: tokenIn as Address,
    tokenOut: tokenOut as Address,
    amountIn,
    feeTier,
    recipient: recipientRaw as Address,
    amountOutMinimum,
    payToAddress: payToAddress as Address,
    chainId,
    nativeIn: isNativeIn,
  });

  // Native ETH: skip approve (router wraps ETH internally via msg.value)
  const execution_order = isNativeIn
    ? ["fee_tx", "swap_tx"]
    : ["approve_tx", "fee_tx", "swap_tx"];

  return NextResponse.json({
    tokenIn,
    tokenOut,
    amountIn: amountIn.toString(),
    feeTier,
    recipient: recipientRaw,
    slippageBps,
    amountOutMinimum: amountOutMinimum.toString(),
    chainId: chain.chainId,
    network: chain.name.toLowerCase(),
    router: chain.router,
    calldata,
    execution_order,
  });
}
