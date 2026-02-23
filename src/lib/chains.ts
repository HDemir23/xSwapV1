import { defineChain, type Chain } from "viem";
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
} from "viem/chains";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ChainConfig {
  name: string;
  chainId: number;
  rpc: string;
  factory: string;
  router: string;
  quoter: string | null;
  weth: string;       // WETH (or WMON on Monad)
  usdc: string;
  explorer: string;
  multicall3: string;
  nativeName: string;  // "ETH", "MON", "MATIC", etc.
  nativeSymbol: string;
}

// ─── Uniswap V3 official deployment addresses ───────────────────────────────
// Source: https://docs.uniswap.org/contracts/v3/reference/deployments
const CHAINS: Record<number, ChainConfig> = {
  1: {
    name: "Ethereum",
    chainId: 1,
    rpc: "https://eth.drpc.org",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorer: "https://etherscan.io",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeName: "Ether",
    nativeSymbol: "ETH",
  },
  42161: {
    name: "Arbitrum",
    chainId: 42161,
    rpc: "https://arb1.arbitrum.io/rpc",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    explorer: "https://arbiscan.io",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeName: "Ether",
    nativeSymbol: "ETH",
  },
  8453: {
    name: "Base",
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    weth: "0x4200000000000000000000000000000000000006",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeName: "Ether",
    nativeSymbol: "ETH",
  },
  10: {
    name: "Optimism",
    chainId: 10,
    rpc: "https://mainnet.optimism.io",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    weth: "0x4200000000000000000000000000000000000006",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    explorer: "https://optimistic.etherscan.io",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeName: "Ether",
    nativeSymbol: "ETH",
  },
  137: {
    name: "Polygon",
    chainId: 137,
    rpc: "https://polygon-rpc.com",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",  // WMATIC
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    explorer: "https://polygonscan.com",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeName: "MATIC",
    nativeSymbol: "MATIC",
  },
  143: {
    name: "Monad",
    chainId: 143,
    rpc: "https://rpc.monad.xyz",
    factory: "0x204faca1764b154221e35c0d20abb3c525710498",
    router: "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900",
    quoter: "0x661e93cca42afacb172121ef892830ca3b70f08d",
    weth: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",  // WMON
    usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    explorer: "https://monadexplorer.com",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeName: "MON",
    nativeSymbol: "MON",
  },
};

// ─── Accessors ───────────────────────────────────────────────────────────────

const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID ?? "1");

export function getChain(chainId?: number): ChainConfig {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const chain = CHAINS[id];
  if (!chain) {
    throw new Error(
      `Unsupported chainId: ${id}. Supported: ${Object.keys(CHAINS).join(", ")}`,
    );
  }
  return chain;
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAINS);
}

export function getSupportedChainIds(): number[] {
  return Object.keys(CHAINS).map(Number);
}

export function isChainSupported(chainId: number): boolean {
  return chainId in CHAINS;
}

// ─── viem chain definitions ─────────────────────────────────────────────────

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://monadexplorer.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: false,
});

// Mapping from chainId to viem Chain object
const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  10: optimism,
  137: polygon,
  143: monadMainnet,
};

export function getViemChain(chainId?: number): Chain {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  const chain = VIEM_CHAINS[id];
  if (!chain) {
    throw new Error(
      `No viem chain definition for chainId: ${id}. Supported: ${Object.keys(VIEM_CHAINS).join(", ")}`,
    );
  }
  return chain;
}

// All wagmi-supported chains (for providers.tsx)
export const allViemChains = Object.values(VIEM_CHAINS) as [Chain, ...Chain[]];

// ─── Backward compat (used by tokens route Monad BFS fallback) ──────────────
const NETWORK = process.env.MONAD_NETWORK ?? "mainnet";
export const config = {
  network: NETWORK,
  rpc: NETWORK === "mainnet" ? "https://rpc.monad.xyz" : "https://testnet-rpc.monad.xyz",
  chainId: NETWORK === "mainnet" ? 143 : 10143,
  uv3Factory: CHAINS[143].factory,
  uv3Router: CHAINS[143].router,
  uv3Quoter: CHAINS[143].quoter,
  wmon: CHAINS[143].weth,
  usdc: CHAINS[143].usdc,
} as const;

export const activeChain = NETWORK === "mainnet" ? monadMainnet : monadTestnet;
