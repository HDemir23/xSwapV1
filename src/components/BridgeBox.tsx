"use client";

import { useState, useCallback, memo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const BRIDGE_CHAINS = [
  {
    name: "Monad",
    chainId: 143,
    usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  },
  {
    name: "Ethereum",
    chainId: 1,
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  {
    name: "Arbitrum",
    chainId: 42161,
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  {
    name: "Base",
    chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
];

interface BridgeResult {
  amountOut?: string;
  estimatedTime?: number;
  fees?: Record<string, unknown>;
  steps?: unknown[];
  [key: string]: unknown;
}

const ChainSelect = memo(function ChainSelect({
  value,
  onChange,
  chains,
  exclude,
}: {
  value: number;
  onChange: (value: number) => void;
  chains: typeof BRIDGE_CHAINS;
  exclude?: number;
}) {
  const filtered = exclude
    ? chains.filter((c) => c.chainId !== exclude)
    : chains;
  return (
    <select
      className="chain-select"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {filtered.map((c) => (
        <option key={c.chainId} value={c.chainId}>
          {c.name}
        </option>
      ))}
    </select>
  );
});

const BridgeResultPanel = memo(function BridgeResultPanel({
  result,
  onClose,
}: {
  result: BridgeResult;
  onClose: () => void;
}) {
  return (
    <div className="result-panel">
      <div className="result-header">
        <span>Bridge Quote</span>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      {result.estimatedTime && (
        <div className="result-time">~{result.estimatedTime}s</div>
      )}
      <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
});

export const BridgeBox = memo(function BridgeBox() {
  const { address } = useAccount();

  const [fromChain, setFromChain] = useState(BRIDGE_CHAINS[0]);
  const [toChain, setToChain] = useState(BRIDGE_CHAINS[1]);
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [error, setError] = useState("");

  const handleFromChain = useCallback((chainId: number) => {
    const chain = BRIDGE_CHAINS.find((c) => c.chainId === chainId);
    if (chain) {
      setFromChain(chain);
      setResult(null);
    }
  }, []);

  const handleToChain = useCallback((chainId: number) => {
    const chain = BRIDGE_CHAINS.find((c) => c.chainId === chainId);
    if (chain) {
      setToChain(chain);
      setResult(null);
    }
  }, []);

  const handleBridge = useCallback(async () => {
    if (!amount || !address) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        originChainId: fromChain.chainId.toString(),
        destinationChainId: toChain.chainId.toString(),
        originCurrency: fromChain.usdc,
        destinationCurrency: toChain.usdc,
        amount,
        user: address,
      });
      const res = await fetch(`/api/bridge?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bridge failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [amount, address, fromChain, toChain]);

  const swapChains = useCallback(() => {
    const tmp = fromChain;
    setFromChain(toChain);
    setToChain(tmp);
    setResult(null);
  }, [fromChain, toChain]);

  const closeResult = useCallback(() => setResult(null), []);

  return (
    <div className="swap-container">
      <div className="swap-box">
        <div className="swap-header">
          <span>Bridge</span>
        </div>

        <div className="input-row chain-row">
          <span className="chain-label">From</span>
          <ChainSelect
            value={fromChain.chainId}
            onChange={handleFromChain}
            chains={BRIDGE_CHAINS}
          />
        </div>

        <div className="input-row">
          <div className="input-amount">
            <input
              type="text"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <span className="token-badge">USDC</span>
        </div>

        <button
          className="flip-button"
          onClick={swapChains}
          aria-label="Swap chains"
        >
          ↓
        </button>

        <div className="input-row chain-row">
          <span className="chain-label">To</span>
          <ChainSelect
            value={toChain.chainId}
            onChange={handleToChain}
            chains={BRIDGE_CHAINS}
            exclude={fromChain.chainId}
          />
        </div>

        <div className="input-row">
          <div className="input-amount">
            <input
              type="text"
              placeholder="0"
              value={result?.amountOut ?? ""}
              readOnly
            />
          </div>
          <span className="token-badge">USDC</span>
        </div>

        {error && <p className="error-text">{error}</p>}

        {!address ? (
          <div className="connect-wrapper">
            <ConnectButton />
          </div>
        ) : result ? (
          <BridgeResultPanel result={result} onClose={closeResult} />
        ) : (
          <button
            className="swap-button"
            onClick={handleBridge}
            disabled={loading || !amount}
          >
            {loading ? "Loading..." : "Get Quote"}
          </button>
        )}
      </div>

      <p className="swap-footer">
        Cross-chain via LI.FI ·{" "}
        <a href="https://li.fi" target="_blank" rel="noreferrer">
          Learn more
        </a>
      </p>
    </div>
  );
});
