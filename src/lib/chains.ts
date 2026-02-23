import { defineChain } from "viem";

const NETWORK = process.env.MONAD_NETWORK ?? "testnet";

// ─── Chain config — mainnet vs testnet ───────────────────────────────────────
export const config = {
  network: NETWORK,
  rpc:
    NETWORK === "mainnet"
      ? "https://rpc.monad.xyz"
      : "https://testnet-rpc.monad.xyz",
  chainId: NETWORK === "mainnet" ? 143 : 10143,
  uv3Factory:
    NETWORK === "mainnet"
      ? "0x204faca1764b154221e35c0d20abb3c525710498"
      : "0x961235a9020b05c44df1026d956d1f4d78014276",
  uv3Router:
    NETWORK === "mainnet"
      ? "0xd6145b2d3f379919e8cdeda7b97e37c4b2ca9c40"
      : "0x9a0a7fbe91895953954cb2ae96aed02e19debbbc",
  // QuoterV2: mainnet confirmed; testnet override via UV3_QUOTER_TESTNET env
  uv3Quoter:
    NETWORK === "mainnet"
      ? "0x661e93cca42afacb172121ef892830ca3b70f08d"
      : (process.env.UV3_QUOTER_TESTNET ?? null),
  wmon:
    NETWORK === "mainnet"
      ? "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A"
      : "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
  usdc:
    NETWORK === "mainnet"
      ? "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"
      : "0x534b2f3A21130d7a60830c2Df862319e593943A3",
} as const;

export type ChainConfig = typeof config;

// ─── viem chain definitions ───────────────────────────────────────────────────
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
  testnet: false,
});

export const activeChain =
  NETWORK === "mainnet" ? monadMainnet : monadTestnet;

// ─── Known tokens for UI ─────────────────────────────────────────────────────
export const KNOWN_TOKENS = {
  testnet: [
    {
      symbol: "WMON",
      address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
      decimals: 18,
    },
    {
      symbol: "USDC",
      address: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
      decimals: 6,
    },
  ],
  mainnet: [
    {
      symbol: "WMON",
      address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
      decimals: 18,
    },
    {
      symbol: "USDC",
      address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
      decimals: 6,
    },
  ],
} as const;

export const activeTokens =
  NETWORK === "mainnet" ? KNOWN_TOKENS.mainnet : KNOWN_TOKENS.testnet;
