"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";

interface Token {
  symbol: string;
  address: string;
  decimals: number;
}

interface ChainInfo {
  chainId: number;
  name: string;
  nativeSymbol: string;
}

function useChains() {
  const [chains, setChains] = useState<ChainInfo[]>([]);

  useEffect(() => {
    fetch("/api/chains")
      .then((r) => r.json())
      .then((data) => {
        if (data.chains?.length) setChains(data.chains);
      })
      .catch(() => {});
  }, []);

  return chains;
}

function useTokens(chainId: number) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chainId) return;
    setLoading(true);
    setTokens([]);
    fetch(`/api/tokens?chainId=${chainId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tokens?.length) setTokens(data.tokens);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chainId]);

  return { tokens, loading };
}

const FEE_TIERS = [
  { label: "0.01%", value: 100 },
  { label: "0.05%", value: 500 },
  { label: "0.30%", value: 3000 },
  { label: "1.00%", value: 10000 },
] as const;

interface SwapResult {
  calldata: {
    approve_tx: {
      to: string;
      data: string;
      value: string;
      description: string;
    };
    fee_tx: { to: string; data: string; value: string; description: string };
    swap_tx: { to: string; data: string; value: string; description: string };
    commission: {
      bps: number;
      feeAmount: string;
      swapAmount: string;
      payTo: string;
    };
  };
  execution_order: string[];
  amountOutMinimum: string;
  network: string;
}

const ChainSelect = memo(function ChainSelect({
  value,
  onChange,
  chains,
}: {
  value: number;
  onChange: (value: number) => void;
  chains: readonly ChainInfo[];
}) {
  return (
    <select
      className="chain-select"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {chains.map((c) => (
        <option key={c.chainId} value={c.chainId}>
          {c.name}
        </option>
      ))}
    </select>
  );
});

const TokenSelect = memo(function TokenSelect({
  value,
  onChange,
  tokens,
}: {
  value: string;
  onChange: (value: string) => void;
  tokens: readonly { symbol: string; address: string; decimals: number }[];
}) {
  return (
    <select
      className="token-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {tokens.map((t) => (
        <option key={t.address} value={t.address}>
          {t.symbol}
        </option>
      ))}
    </select>
  );
});

const SettingsPanel = memo(function SettingsPanel({
  slippage,
  feeTier,
  onSlippageChange,
  onFeeTierChange,
}: {
  slippage: string;
  feeTier: number;
  onSlippageChange: (value: string) => void;
  onFeeTierChange: (value: number) => void;
}) {
  return (
    <div className="settings-panel">
      <div className="setting-row">
        <span>Slippage</span>
        <div className="slippage-input">
          <input
            type="number"
            value={slippage}
            onChange={(e) => onSlippageChange(e.target.value)}
            placeholder="0.5"
            step="0.1"
            min="0"
            max="50"
          />
          <span>%</span>
        </div>
      </div>
      <div className="setting-row">
        <span>Fee Tier</span>
        <select
          value={feeTier}
          onChange={(e) => onFeeTierChange(Number(e.target.value))}
        >
          {FEE_TIERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

const ResultPanel = memo(function ResultPanel({
  result,
  onClose,
}: {
  result: SwapResult;
  onClose: () => void;
}) {
  return (
    <div className="result-panel">
      <div className="result-header">
        <span>Swap Calldata</span>
        <button className="close-btn" onClick={onClose}>
          x
        </button>
      </div>
      <div className="result-steps">
        {result.execution_order.map((step, i) => (
          <div key={i} className="step">
            {step}
          </div>
        ))}
      </div>
      <div className="commission">
        Fee: {result.calldata.commission.bps / 100}%
      </div>
      <pre className="code-block">
        {JSON.stringify(result.calldata, null, 2)}
      </pre>
    </div>
  );
});

export const SwapBox = memo(function SwapBox() {
  const { address, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const chains = useChains();

  const [selectedChainId, setSelectedChainId] = useState(1);
  const { tokens, loading: tokensLoading } = useTokens(selectedChainId);

  const [tokenIn, setTokenIn] = useState("");
  const [tokenOut, setTokenOut] = useState("");

  // Set defaults once tokens load
  useEffect(() => {
    if (tokens.length >= 2) {
      setTokenIn(tokens[0].address);
      setTokenOut(tokens[1].address);
    } else if (tokens.length === 1) {
      setTokenIn(tokens[0].address);
      setTokenOut("");
    } else {
      setTokenIn("");
      setTokenOut("");
    }
  }, [tokens]);

  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [feeTier, setFeeTier] = useState(3000);
  const [slippage, setSlippage] = useState("0.5");

  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState("");

  const handleChainChange = useCallback(
    (newChainId: number) => {
      setSelectedChainId(newChainId);
      setAmountOut("");
      setResult(null);
      setError("");
      // Ask wallet to switch chain
      if (address && walletChainId !== newChainId) {
        switchChain?.({ chainId: newChainId });
      }
    },
    [address, walletChainId, switchChain],
  );

  const handleQuote = useCallback(async () => {
    if (!amountIn) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&feeTier=${feeTier}&chainId=${selectedChainId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quote failed");
      setAmountOut(data.amountOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [amountIn, tokenIn, tokenOut, feeTier, selectedChainId]);

  const handleSwap = useCallback(async () => {
    if (!amountIn || !address) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn,
          feeTier,
          recipient: address,
          slippageBps: Number(slippage) * 100,
          chainId: selectedChainId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Swap failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [amountIn, tokenIn, tokenOut, feeTier, address, slippage, selectedChainId]);

  const flipTokens = useCallback(() => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    setAmountOut("");
    setResult(null);
  }, [tokenIn, tokenOut, amountOut]);

  const closeResult = useCallback(() => setResult(null), []);

  const isSwapReady = useMemo(() => amountOut && !result, [amountOut, result]);

  const currentChainName = useMemo(
    () => chains.find((c) => c.chainId === selectedChainId)?.name ?? "Chain",
    [chains, selectedChainId],
  );

  return (
    <div className="swap-container">
      <div className="swap-box">
        <div className="swap-header">
          <span>Swap</span>
          <div className="swap-header-controls">
            {chains.length > 0 && (
              <ChainSelect
                value={selectedChainId}
                onChange={handleChainChange}
                chains={chains}
              />
            )}
            <button
              className="settings-btn"
              onClick={() => setShowSettings((s) => !s)}
              aria-label="Settings"
            >
              &#x2699;
            </button>
          </div>
        </div>

        {showSettings && (
          <SettingsPanel
            slippage={slippage}
            feeTier={feeTier}
            onSlippageChange={setSlippage}
            onFeeTierChange={setFeeTier}
          />
        )}

        <div className="input-row">
          <div className="input-amount">
            <input
              type="text"
              placeholder="0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </div>
          <TokenSelect value={tokenIn} onChange={setTokenIn} tokens={tokens} />
        </div>

        <button
          className="flip-button"
          onClick={flipTokens}
          aria-label="Flip tokens"
        >
          &#x2193;
        </button>

        <div className="input-row">
          <div className="input-amount">
            <input type="text" placeholder="0" value={amountOut} readOnly />
          </div>
          <TokenSelect
            value={tokenOut}
            onChange={setTokenOut}
            tokens={tokens}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        {!address ? (
          <div className="connect-wrapper">
            <ConnectButton />
          </div>
        ) : result ? (
          <ResultPanel result={result} onClose={closeResult} />
        ) : (
          <button
            className="swap-button"
            onClick={isSwapReady ? handleSwap : handleQuote}
            disabled={loading || tokensLoading || !amountIn || !tokenIn}
          >
            {tokensLoading ? "Loading tokens..." : loading ? "Loading..." : isSwapReady ? "Swap" : "Quote"}
          </button>
        )}
      </div>

      <p className="swap-footer">
        0.5% fee &middot; {currentChainName} &middot; <a href="/docs">API Docs</a>
      </p>
    </div>
  );
});
