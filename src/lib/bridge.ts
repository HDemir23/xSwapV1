// Relay Protocol bridge integration
// Docs: https://docs.relay.link/references/api/get-quote

const RELAY_API = "https://api.relay.link";

export interface BridgeQuoteParams {
  originChainId: number;
  destinationChainId: number;
  originCurrency: string; // token address or "0x0000...0000" for native
  destinationCurrency: string;
  amount: string; // amount in wei/atomic units
  user: string; // sender address
  recipient?: string; // defaults to user
}

export interface BridgeQuoteResult {
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amountIn: string;
  amountOut: string;
  fees: {
    gas?: string;
    relayer?: string;
    app?: string;
  };
  estimatedTime: number; // seconds
  steps: BridgeStep[];
  raw: unknown;
}

export interface BridgeStep {
  id: string;
  action: string;
  description: string;
}

export async function getBridgeQuote(
  params: BridgeQuoteParams
): Promise<BridgeQuoteResult> {
  const url = new URL(`${RELAY_API}/quote`);
  url.searchParams.set("originChainId", String(params.originChainId));
  url.searchParams.set(
    "destinationChainId",
    String(params.destinationChainId)
  );
  url.searchParams.set("originCurrency", params.originCurrency);
  url.searchParams.set("destinationCurrency", params.destinationCurrency);
  url.searchParams.set("amount", params.amount);
  url.searchParams.set("user", params.user);
  if (params.recipient) {
    url.searchParams.set("recipient", params.recipient);
  }
  url.searchParams.set("tradeType", "EXACT_INPUT");

  const res = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 0 }, // always fresh
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Relay API error ${res.status}: ${err}`);
  }

  const data = await res.json();

  // Normalize Relay response → our schema
  const fees = data.fees ?? {};
  const steps: BridgeStep[] = (data.steps ?? []).map(
    (s: Record<string, unknown>, i: number) => ({
      id: String(s.id ?? i),
      action: String(s.action ?? ""),
      description: String(s.description ?? ""),
    })
  );

  return {
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId,
    originCurrency: params.originCurrency,
    destinationCurrency: params.destinationCurrency,
    amountIn: String(data.details?.currencyIn?.amount ?? params.amount),
    amountOut: String(data.details?.currencyOut?.amount ?? "0"),
    fees: {
      gas: String(fees.gas?.amount ?? "0"),
      relayer: String(fees.relayer?.amount ?? "0"),
      app: String(fees.app?.amount ?? "0"),
    },
    estimatedTime: Number(data.details?.timeEstimate ?? 60),
    steps,
    raw: data,
  };
}
