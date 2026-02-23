"use client";

import { useState, useCallback, memo, useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

interface HistoryItem {
  txHash: string;
  blockNumber: string;
  pool: string;
  amount0: string;
  amount1: string;
  network: string;
}

const HistoryCard = memo(function HistoryCard({ item }: { item: HistoryItem }) {
  const explorerUrl = useMemo(
    () => `https://testnet.monadexplorer.com/tx/${item.txHash}`,
    [item.txHash],
  );

  const truncatedTx = useMemo(
    () => `${item.txHash.slice(0, 10)}...${item.txHash.slice(-6)}`,
    [item.txHash],
  );

  const truncatedPool = useMemo(
    () => `${item.pool.slice(0, 8)}...${item.pool.slice(-6)}`,
    [item.pool],
  );

  return (
    <div className="history-item">
      <div className="history-item-header">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="tx-link"
        >
          {truncatedTx}
        </a>
        <span className="block-num">#{item.blockNumber}</span>
      </div>
      <div className="history-item-body">
        <div className="pool-info">
          Pool: <code>{truncatedPool}</code>
        </div>
        <div className="amounts">
          <span>amount0: {item.amount0}</span>
          <span>amount1: {item.amount1}</span>
        </div>
      </div>
    </div>
  );
});

const EmptyState = memo(function EmptyState({
  isConnected,
}: {
  isConnected: boolean;
}) {
  if (!isConnected) {
    return (
      <div className="history-empty">
        <p>Connect wallet to view your history</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="history-empty-state">
      <p>No swaps found in the last 10,000 blocks</p>
    </div>
  );
});

export const HistoryBox = memo(function HistoryBox() {
  const { address, isConnected } = useAccount();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/history?address=${address}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setHistory(data.swaps ?? []);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  const shouldShowEmpty = useMemo(
    () => hasLoaded && history.length === 0,
    [hasLoaded, history.length],
  );

  if (!isConnected) {
    return (
      <div className="history-container">
        <EmptyState isConnected={false} />
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>Swap History</h1>
        <button
          className="refresh-btn"
          onClick={loadHistory}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {shouldShowEmpty && !loading ? (
        <EmptyState isConnected={true} />
      ) : (
        <div className="history-list">
          {history.map((item, i) => (
            <HistoryCard key={item.txHash + i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
});
