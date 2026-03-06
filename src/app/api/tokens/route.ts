import { NextRequest, NextResponse } from "next/server";
import { type Address, erc20Abi } from "viem";
import { getRpcClient, FACTORY_ABI } from "@/lib/uniswap";
import { getChain, isChainSupported } from "@/lib/chains";

interface TokenInfo {
  address: string;    // "native" for ETH/MON/MATIC
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

// Per-chain in-memory cache: refresh every 5 minutes
const cacheMap = new Map<number, { tokens: TokenInfo[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const FEE_TIERS = [100, 500, 3000, 10000] as const;

// ─── Native token logos ─────────────────────────────────────────────────────
const NATIVE_LOGOS: Record<string, string> = {
  ETH: "https://assets-cdn.trustwallet.com/blockchains/ethereum/info/logo.png",
  MATIC: "https://assets-cdn.trustwallet.com/blockchains/polygon/info/logo.png",
  MON: "/mon-logo.png",
};

// Trust Wallet CDN chain slug mapping
const TW_CHAIN_SLUG: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  8453: "base",
  10: "optimism",
  137: "polygon",
};

function getTrustWalletLogoURI(chainId: number, address: string): string | undefined {
  const slug = TW_CHAIN_SLUG[chainId];
  if (!slug) return undefined;
  return `https://assets-cdn.trustwallet.com/blockchains/${slug}/assets/${address}/logo.png`;
}

function buildNativeToken(chain: ReturnType<typeof getChain>): TokenInfo {
  return {
    address: "native",
    symbol: chain.nativeSymbol,
    name: chain.nativeName,
    decimals: 18,
    chainId: chain.chainId,
    logoURI: NATIVE_LOGOS[chain.nativeSymbol],
  };
}

// ─── Uniswap Token List (for EVM mainnets) ──────────────────────────────────
let uniswapTokenList: { chainId: number; address: string; symbol: string; name: string; decimals: number; logoURI?: string }[] | null = null;
let uniswapTokenListTs = 0;

async function fetchUniswapTokenList() {
  // Cache for 30 minutes
  if (uniswapTokenList && Date.now() - uniswapTokenListTs < 30 * 60 * 1000) {
    return uniswapTokenList;
  }
  try {
    const res = await fetch("https://tokens.uniswap.org", {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    uniswapTokenList = data.tokens ?? [];
    uniswapTokenListTs = Date.now();
    return uniswapTokenList;
  } catch {
    return uniswapTokenList ?? [];
  }
}

async function getTokensFromUniswapList(chainId: number): Promise<TokenInfo[]> {
  const list = await fetchUniswapTokenList();
  if (!list) return [];

  const chain = getChain(chainId);
  const filtered = list.filter((t) => t.chainId === chainId);

  // Always include WETH/WMATIC + USDC even if not in list
  const tokens: TokenInfo[] = filtered.map((t) => ({
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    chainId,
    logoURI: t.logoURI || getTrustWalletLogoURI(chainId, t.address),
  }));

  // Ensure native wrapped + USDC are present
  const addresses = new Set(tokens.map((t) => t.address.toLowerCase()));

  if (!addresses.has(chain.weth.toLowerCase())) {
    tokens.unshift({
      address: chain.weth,
      symbol: chain.nativeSymbol === "ETH" ? "WETH" : `W${chain.nativeSymbol}`,
      name: `Wrapped ${chain.nativeName}`,
      decimals: 18,
      chainId,
      logoURI: getTrustWalletLogoURI(chainId, chain.weth),
    });
  }
  if (!addresses.has(chain.usdc.toLowerCase())) {
    tokens.unshift({
      address: chain.usdc,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      chainId,
      logoURI: getTrustWalletLogoURI(chainId, chain.usdc),
    });
  }

  // Sort: native first, USDC second, wrapped native third, rest alphabetical
  const nativeWrappedSymbol = chain.nativeSymbol === "ETH" ? "WETH" : `W${chain.nativeSymbol}`;
  tokens.sort((a, b) => {
    if (a.address === "native") return -1;
    if (b.address === "native") return 1;
    if (a.symbol === "USDC") return -1;
    if (b.symbol === "USDC") return 1;
    if (a.symbol === nativeWrappedSymbol) return -1;
    if (b.symbol === nativeWrappedSymbol) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  // Prepend native token
  tokens.unshift(buildNativeToken(chain));

  return tokens;
}

// ─── Monad BFS discovery (factory scanning) ──────────────────────────────────
async function discoverMonadTokens(chainId: number): Promise<TokenInfo[]> {
  const chain = getChain(chainId);
  const client = getRpcClient(chainId);
  const factory = chain.factory as Address;

  const SEED_TOKENS: Address[] = [
    chain.weth as Address,
    chain.usdc as Address,
  ];

  // BFS: discover tokens by querying factory.getPool for all known pairs x fee tiers
  const known = new Set<string>(SEED_TOKENS.map((a) => a.toLowerCase()));
  let frontier = [...SEED_TOKENS];

  for (let round = 0; round < 3 && frontier.length > 0; round++) {
    const calls = [];
    const callMeta: { a: Address; b: Address }[] = [];

    const knownArr = [...known] as Address[];
    for (const newToken of frontier) {
      for (const existing of knownArr) {
        if (newToken.toLowerCase() === existing.toLowerCase()) continue;
        for (const fee of FEE_TIERS) {
          calls.push({
            address: factory,
            abi: FACTORY_ABI,
            functionName: "getPool" as const,
            args: [newToken, existing, fee] as const,
          });
          callMeta.push({ a: newToken as Address, b: existing });
        }
      }
    }

    if (calls.length === 0) break;

    const results = await client.multicall({ contracts: calls });

    const newlyFound = new Set<string>();
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (
        r.status === "success" &&
        r.result &&
        r.result !== "0x0000000000000000000000000000000000000000"
      ) {
        const { a, b } = callMeta[i];
        if (!known.has(a.toLowerCase())) {
          known.add(a.toLowerCase());
          newlyFound.add(a.toLowerCase());
        }
        if (!known.has(b.toLowerCase())) {
          known.add(b.toLowerCase());
          newlyFound.add(b.toLowerCase());
        }
      }
    }

    frontier = [...newlyFound] as Address[];
  }

  // Fetch ERC20 metadata for all discovered tokens
  const addresses = [...known] as Address[];
  const metaCalls = addresses.flatMap((addr) => [
    { address: addr, abi: erc20Abi, functionName: "symbol" as const },
    { address: addr, abi: erc20Abi, functionName: "name" as const },
    { address: addr, abi: erc20Abi, functionName: "decimals" as const },
  ]);

  const metaResults = await client.multicall({ contracts: metaCalls });

  const tokens: TokenInfo[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const sym = metaResults[i * 3];
    const name = metaResults[i * 3 + 1];
    const dec = metaResults[i * 3 + 2];

    if (
      sym.status === "success" &&
      name.status === "success" &&
      dec.status === "success"
    ) {
      tokens.push({
        address: addresses[i],
        symbol: sym.result as string,
        name: name.result as string,
        decimals: dec.result as number,
        chainId,
        logoURI: undefined, // Monad tokens don't have CDN logos yet
      });
    }
  }

  // Sort: USDC second, WMON third, rest alphabetical (native will be prepended)
  tokens.sort((a, b) => {
    if (a.symbol === "USDC") return -1;
    if (b.symbol === "USDC") return 1;
    if (a.symbol === "WMON") return -1;
    if (b.symbol === "WMON") return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  // Prepend native token
  tokens.unshift(buildNativeToken(chain));

  return tokens;
}

// ─── Main discovery with cache ───────────────────────────────────────────────
const MONAD_CHAIN_ID = 143;

async function discoverTokens(chainId: number): Promise<TokenInfo[]> {
  const cached = cacheMap.get(chainId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tokens;

  let tokens: TokenInfo[];
  if (chainId === MONAD_CHAIN_ID) {
    // Monad: use BFS factory scanning (not in Uniswap token list)
    tokens = await discoverMonadTokens(chainId);
  } else {
    // All other EVM chains: use Uniswap public token list
    tokens = await getTokensFromUniswapList(chainId);
  }

  cacheMap.set(chainId, { tokens, ts: Date.now() });
  return tokens;
}

// GET /api/tokens?chainId=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const chainIdStr = searchParams.get("chainId");

  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined;
  if (chainId !== undefined && !isChainSupported(chainId)) {
    return NextResponse.json(
      { error: `Unsupported chainId: ${chainId}` },
      { status: 400 }
    );
  }

  const resolvedChainId = chainId ?? (getChain().chainId);

  try {
    const chain = getChain(resolvedChainId);
    const tokens = await discoverTokens(resolvedChainId);
    return NextResponse.json({
      chainId: chain.chainId,
      network: chain.name.toLowerCase(),
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to discover tokens", detail: String(err) },
      { status: 500 },
    );
  }
}
