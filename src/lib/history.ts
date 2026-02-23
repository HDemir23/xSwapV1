import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { getChain, getViemChain } from "./chains";

// Uniswap V3 Pool Swap event
const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

export interface SwapHistoryItem {
  txHash: string;
  blockNumber: string;
  pool: string;
  sender: string;
  recipient: string;
  amount0: string;
  amount1: string;
  sqrtPriceX96: string;
  network: string;
  chainId: number;
}

export async function getWalletSwapHistory(
  address: Address,
  limit: number = 20,
  chainId?: number,
): Promise<SwapHistoryItem[]> {
  const chain = getChain(chainId);
  const client = createPublicClient({
    chain: getViemChain(chainId),
    transport: http(chain.rpc),
  });

  // Get latest block
  const latestBlock = await client.getBlockNumber();
  // Look back ~10k blocks
  const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;

  // Fetch Swap events where recipient = address (wallet received tokens)
  // Also check sender = address (wallet initiated swap)
  const [recipientLogs, senderLogs] = await Promise.all([
    client.getLogs({
      event: SWAP_EVENT,
      args: { recipient: address },
      fromBlock,
      toBlock: latestBlock,
    }),
    client.getLogs({
      event: SWAP_EVENT,
      args: { sender: address },
      fromBlock,
      toBlock: latestBlock,
    }),
  ]);

  // Merge and deduplicate by txHash
  const allLogs = [...recipientLogs, ...senderLogs];
  const seen = new Set<string>();
  const unique = allLogs.filter((log) => {
    const key = `${log.transactionHash}-${log.address}-${log.logIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by blockNumber descending (most recent first)
  unique.sort((a, b) => {
    const diff = (b.blockNumber ?? 0n) - (a.blockNumber ?? 0n);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
  });

  return unique.slice(0, limit).map((log) => ({
    txHash: log.transactionHash ?? "",
    blockNumber: String(log.blockNumber ?? 0n),
    pool: log.address,
    sender: log.args.sender ?? "",
    recipient: log.args.recipient ?? "",
    amount0: String(log.args.amount0 ?? 0n),
    amount1: String(log.args.amount1 ?? 0n),
    sqrtPriceX96: String(log.args.sqrtPriceX96 ?? 0n),
    network: chain.name.toLowerCase(),
    chainId: chain.chainId,
  }));
}
