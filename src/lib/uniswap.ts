import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
} from "viem";
import { getChain, getViemChain } from "./chains";

// ─── ABIs ─────────────────────────────────────────────────────────────────────
export const FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const POOL_SLOT0_ABI = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
    ],
  },
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Shared RPC client ────────────────────────────────────────────────────────
export function getRpcClient(chainId?: number) {
  const chain = getChain(chainId);
  return createPublicClient({
    chain: getViemChain(chainId),
    transport: http(chain.rpc),
  });
}

// ─── Quote ────────────────────────────────────────────────────────────────────
export interface QuoteParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  feeTier: number;
  chainId?: number;
}

export interface QuoteResult {
  amountOut: bigint;
  amountOutFormatted: string;
  sqrtPriceX96After: bigint;
  gasEstimate: bigint;
  quoterUsed: boolean;
  fallback: boolean;
  method: "quoterV2" | "slot0" | "none";
}

export async function getQuote(params: QuoteParams): Promise<QuoteResult> {
  const { tokenIn, tokenOut, amountIn, feeTier, chainId } = params;
  const chain = getChain(chainId);
  const client = getRpcClient(chainId);

  if (chain.quoter) {
    try {
      const result = await client.simulateContract({
        address: chain.quoter as Address,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn,
            tokenOut,
            amountIn,
            fee: feeTier,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const [amountOut, sqrtPriceX96After, , gasEstimate] = result.result as [
        bigint,
        bigint,
        number,
        bigint,
      ];

      return {
        amountOut,
        amountOutFormatted: amountOut.toString(),
        sqrtPriceX96After,
        gasEstimate,
        quoterUsed: true,
        fallback: false,
        method: "quoterV2",
      };
    } catch {
      // Fall through to slot0 fallback
    }
  }

  // slot0 fallback: read sqrtPriceX96 directly from the pool and compute price off-chain
  const poolAddress = await client.readContract({
    address: chain.factory as Address,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenIn, tokenOut, feeTier],
  });

  if (poolAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Pool not found for fee tier ${feeTier}`);
  }

  const [token0, slot0Result] = await Promise.all([
    client.readContract({
      address: poolAddress,
      abi: POOL_SLOT0_ABI,
      functionName: "token0",
    }),
    client.readContract({
      address: poolAddress,
      abi: POOL_SLOT0_ABI,
      functionName: "slot0",
    }),
  ]);

  // slot0 returns [sqrtPriceX96, tick]; viem infers the tuple from ABI
  const [sqrtPriceX96] = slot0Result as unknown as [bigint, number];

  // price = sqrtPriceX96^2 / 2^192  →  token1_raw per token0_raw
  const Q192 = 2n ** 192n;
  let amountOut: bigint;

  if (tokenIn.toLowerCase() === (token0 as string).toLowerCase()) {
    // tokenIn is token0, buy token1
    amountOut = (amountIn * sqrtPriceX96 * sqrtPriceX96) / Q192;
  } else {
    // tokenIn is token1, buy token0
    amountOut = (amountIn * Q192) / (sqrtPriceX96 * sqrtPriceX96);
  }

  return {
    amountOut,
    amountOutFormatted: amountOut.toString(),
    sqrtPriceX96After: sqrtPriceX96,
    gasEstimate: 0n,
    quoterUsed: false,
    fallback: true,
    method: "slot0",
  };
}

// ─── Build swap calldata (split: fee_tx + swap_tx) ───────────────────────────
export interface SwapCalldataParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  feeTier: number;
  recipient: Address;
  amountOutMinimum: bigint;
  payToAddress: Address;
  chainId?: number;
  nativeIn?: boolean;
}

export interface SwapCalldata {
  approve_tx: {
    to: Address;
    data: `0x${string}`;
    value: string;
    description: string;
  };
  fee_tx: {
    to: Address;
    data: `0x${string}`;
    value: string;
    description: string;
  };
  swap_tx: {
    to: Address;
    data: `0x${string}`;
    value: string;
    description: string;
  };
  commission: {
    bps: number;
    feeAmount: string;
    swapAmount: string;
    payTo: Address;
  };
}

export function buildSwapCalldata(params: SwapCalldataParams): SwapCalldata {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    feeTier,
    recipient,
    amountOutMinimum,
    payToAddress,
    chainId,
    nativeIn,
  } = params;

  const chain = getChain(chainId);

  // 0.5% commission split
  const feeBps = 50n; // 0.5% = 50 bps
  const feeAmount = (amountIn * feeBps) / 10000n;
  const swapAmount = amountIn - feeAmount;

  const router = chain.router as Address;

  // swap_tx calldata is the same for both native and ERC20
  // (SwapRouter02 accepts msg.value for native ETH and wraps internally)
  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee: feeTier,
        recipient,
        amountIn: swapAmount,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  if (nativeIn) {
    // Native ETH flow:
    // - No approve needed (router wraps ETH→WETH internally via msg.value)
    // - Fee is a plain ETH transfer (not ERC20)
    // - Swap sends ETH as msg.value
    return {
      approve_tx: {
        to: payToAddress, // unused — won't be in execution_order
        data: "0x" as `0x${string}`,
        value: "0",
        description: "No approval needed for native ETH",
      },
      fee_tx: {
        to: payToAddress,
        data: "0x" as `0x${string}`,
        value: feeAmount.toString(),
        description: `Send ${feeAmount.toString()} wei (0.5% commission) to ${payToAddress}`,
      },
      swap_tx: {
        to: router,
        data: swapData,
        value: swapAmount.toString(),
        description: `Uniswap V3 exactInputSingle — swap ${swapAmount.toString()} wei native ETH → ${tokenOut}`,
      },
      commission: {
        bps: 50,
        feeAmount: feeAmount.toString(),
        swapAmount: swapAmount.toString(),
        payTo: payToAddress,
      },
    };
  }

  // ERC20 flow: approve + ERC20 transfer fee + swap
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [router, swapAmount],
  });

  const feeData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [payToAddress, feeAmount],
  });

  return {
    approve_tx: {
      to: tokenIn,
      data: approveData,
      value: "0",
      description: `Approve ${router} to spend ${swapAmount.toString()} of ${tokenIn}`,
    },
    fee_tx: {
      to: tokenIn,
      data: feeData,
      value: "0",
      description: `Transfer ${feeAmount.toString()} (0.5% commission) to ${payToAddress}`,
    },
    swap_tx: {
      to: router,
      data: swapData,
      value: "0",
      description: `Uniswap V3 exactInputSingle — swap ${swapAmount.toString()} of ${tokenIn} → ${tokenOut}`,
    },
    commission: {
      bps: 50,
      feeAmount: feeAmount.toString(),
      swapAmount: swapAmount.toString(),
      payTo: payToAddress,
    },
  };
}
