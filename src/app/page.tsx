"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { SakuraLeaves } from "@/components/SakuraLeaves";

// ─── Token list (testnet defaults, UI only) ───────────────────────────────────
const TOKENS = [
  { symbol: "WMON", address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701", decimals: 18 },
  { symbol: "USDC", address: "0x534b2f3A21130d7a60830c2Df862319e593943A3", decimals: 6 },
];

const FEE_TIERS = [
  { label: "0.01%", value: 100 },
  { label: "0.05%", value: 500 },
  { label: "0.30%", value: 3000 },
  { label: "1.00%", value: 10000 },
];

// ─── Bridge chain config ─────────────────────────────────────────────────────
const BRIDGE_CHAINS = [
  { name: "Monad Testnet", chainId: 10143, usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3" },
  { name: "Ethereum", chainId: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { name: "Arbitrum", chainId: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  { name: "Base", chainId: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuoteResult {
  amountOut: string;
  feeTier: number;
  quoterUsed: boolean;
  fallback: boolean;
  method?: "quoterV2" | "slot0" | "none";
  note?: string;
  warning?: string;
  network: string;
  priceImpactBps?: number;
}

interface SwapResult {
  calldata: {
    approve_tx: { to: string; data: string; value: string; description: string };
    fee_tx: { to: string; data: string; value: string; description: string };
    swap_tx: { to: string; data: string; value: string; description: string };
    commission: { bps: number; feeAmount: string; swapAmount: string; payTo: string };
  };
  execution_order: string[];
  amountOutMinimum: string;
  network: string;
}

interface HistoryItem {
  txHash: string;
  blockNumber: string;
  pool: string;
  amount0: string;
  amount1: string;
  network: string;
}

interface BridgeResult {
  amountOut?: string;
  estimatedTime?: number;
  fees?: Record<string, unknown>;
  steps?: unknown[];
  [key: string]: unknown;
}

// ─── Input styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--gradient)",
  border: "none",
  borderRadius: "8px",
  padding: "12px 24px",
  color: "#08080A",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  letterSpacing: "0.02em",
  transition: "opacity 0.2s ease",
  width: "100%",
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  padding: "12px 24px",
  color: "var(--text-primary)",
  fontWeight: 500,
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  width: "100%",
};

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: "12px",
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "12px",
        fontWeight: 500,
        color: "var(--text-secondary)",
        marginBottom: "6px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </label>
  );
}

// ─── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ data }: { data: unknown }) {
  return (
    <pre
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "16px",
        fontSize: "11px",
        color: "var(--accent)",
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        marginTop: "12px",
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Swap Form ────────────────────────────────────────────────────────────────
function SwapForm() {
  const { address } = useAccount();

  const [tokenIn, setTokenIn] = useState(TOKENS[0].address);
  const [tokenOut, setTokenOut] = useState(TOKENS[1].address);
  const [amountIn, setAmountIn] = useState("");
  const [feeTier, setFeeTier] = useState(3000);
  const [slippageBps, setSlippageBps] = useState(100);
  const [recipient, setRecipient] = useState("");

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState("");

  const [swapLoading, setSwapLoading] = useState(false);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [swapError, setSwapError] = useState("");

  // Sync recipient with connected wallet
  useEffect(() => {
    if (address && !recipient) setRecipient(address);
  }, [address, recipient]);

  const handleQuote = useCallback(async () => {
    if (!amountIn || !tokenIn || !tokenOut) return;
    setQuoteLoading(true);
    setQuoteError("");
    setQuoteResult(null);
    try {
      const res = await fetch(
        `/api/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&feeTier=${feeTier}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quote failed");
      setQuoteResult(data);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuoteLoading(false);
    }
  }, [amountIn, tokenIn, tokenOut, feeTier]);

  const handleSwap = useCallback(async () => {
    if (!amountIn || !tokenIn || !tokenOut || !recipient) return;
    setSwapLoading(true);
    setSwapError("");
    setSwapResult(null);
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIn, tokenOut, amountIn, feeTier, recipient, slippageBps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Swap calldata failed");
      setSwapResult(data);
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwapLoading(false);
    }
  }, [amountIn, tokenIn, tokenOut, feeTier, recipient, slippageBps]);

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setQuoteResult(null);
    setSwapResult(null);
  };

  return (
    <Card>
      <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px" }}>
        Swap Tokens
      </h2>

      <div style={{ display: "grid", gap: "16px" }}>
        {/* Token In */}
        <div>
          <Label>Token In</Label>
          <select style={selectStyle} value={tokenIn} onChange={e => setTokenIn(e.target.value)}>
            {TOKENS.map(t => (
              <option key={t.address} value={t.address}>{t.symbol} — {t.address.slice(0, 10)}…</option>
            ))}
          </select>
        </div>

        {/* Amount In */}
        <div>
          <Label>Amount In (wei)</Label>
          <input
            style={inputStyle}
            type="text"
            placeholder="e.g. 1000000000000000000 (= 1 WMON)"
            value={amountIn}
            onChange={e => setAmountIn(e.target.value)}
          />
        </div>

        {/* Flip button */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={flipTokens}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-strong)",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              color: "var(--accent)",
              fontSize: "16px",
            }}
            title="Flip tokens"
          >
            ⇅
          </button>
        </div>

        {/* Token Out */}
        <div>
          <Label>Token Out</Label>
          <select style={selectStyle} value={tokenOut} onChange={e => setTokenOut(e.target.value)}>
            {TOKENS.map(t => (
              <option key={t.address} value={t.address}>{t.symbol} — {t.address.slice(0, 10)}…</option>
            ))}
          </select>
        </div>

        {/* Fee Tier + Slippage */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <Label>Fee Tier</Label>
            <select style={selectStyle} value={feeTier} onChange={e => setFeeTier(Number(e.target.value))}>
              {FEE_TIERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Slippage (bps)</Label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              max={10000}
              value={slippageBps}
              onChange={e => setSlippageBps(Number(e.target.value))}
              title="Basis points: 100 = 1%"
            />
          </div>
        </div>

        {/* Recipient */}
        <div>
          <Label>Recipient Address</Label>
          <input
            style={inputStyle}
            type="text"
            placeholder="0x... (defaults to connected wallet)"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
          <button
            style={{ ...btnSecondary, opacity: quoteLoading ? 0.6 : 1 }}
            onClick={handleQuote}
            disabled={quoteLoading || !amountIn}
          >
            {quoteLoading ? "Quoting…" : "Get Quote"}
          </button>
          <button
            style={{ ...btnPrimary, opacity: swapLoading ? 0.6 : 1 }}
            onClick={handleSwap}
            disabled={swapLoading || !amountIn || !recipient}
          >
            {swapLoading ? "Building…" : "Get Calldata"}
          </button>
        </div>

        {/* Quote Result */}
        {quoteError && (
          <p style={{ color: "var(--error)", fontSize: "13px" }}>{quoteError}</p>
        )}
        {quoteResult && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Quote result
              {quoteResult.method && (
                <span style={{ marginLeft: "8px", color: "var(--accent)", fontSize: "11px", fontFamily: "monospace" }}>
                  via {quoteResult.method}
                </span>
              )}
              {quoteResult.fallback && (
                <span style={{ color: "var(--warning)", marginLeft: "8px" }}>
                  (no on-chain quoter — set UV3_QUOTER_TESTNET)
                </span>
              )}
            </p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)" }}>
              {quoteResult.amountOut} <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>out</span>
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
              Network: {quoteResult.network} · Fee tier: {quoteResult.feeTier / 10000}%
            </p>
            {quoteResult.note && (
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px", fontStyle: "italic" }}>{quoteResult.note}</p>
            )}
            {quoteResult.warning && (
              <p style={{ fontSize: "12px", color: "var(--warning)", marginTop: "4px" }}>{quoteResult.warning}</p>
            )}
          </div>
        )}

        {/* Swap Result */}
        {swapError && (
          <p style={{ color: "var(--error)", fontSize: "13px" }}>{swapError}</p>
        )}
        {swapResult && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Swap calldata — execute in order:
            </p>
            {swapResult.execution_order.map((step, i) => (
              <p key={i} style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "4px" }}>
                {step}
              </p>
            ))}
            <div style={{ marginTop: "8px", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px", fontSize: "12px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Commission: </span>
              <span style={{ color: "var(--accent)" }}>
                {swapResult.calldata.commission.bps / 100}% ({swapResult.calldata.commission.feeAmount} units → {swapResult.calldata.commission.payTo.slice(0, 10)}…)
              </span>
            </div>
            <CodeBlock data={swapResult.calldata} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Bridge Form ──────────────────────────────────────────────────────────────
function BridgeForm() {
  const { address } = useAccount();

  const [originChain, setOriginChain] = useState(BRIDGE_CHAINS[0]);
  const [destChain, setDestChain] = useState(BRIDGE_CHAINS[1]);
  const [originCurrency, setOriginCurrency] = useState(BRIDGE_CHAINS[0].usdc);
  const [destCurrency, setDestCurrency] = useState(BRIDGE_CHAINS[1].usdc);
  const [amount, setAmount] = useState("");
  const [user, setUser] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (address && !user) setUser(address);
  }, [address, user]);

  // Sync token addresses when chains change
  const handleOriginChange = (chainId: number) => {
    const chain = BRIDGE_CHAINS.find(c => c.chainId === chainId)!;
    setOriginChain(chain);
    setOriginCurrency(chain.usdc);
  };

  const handleDestChange = (chainId: number) => {
    const chain = BRIDGE_CHAINS.find(c => c.chainId === chainId)!;
    setDestChain(chain);
    setDestCurrency(chain.usdc);
  };

  const handleBridgeQuote = useCallback(async () => {
    if (!amount || !user) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({
        originChainId: originChain.chainId.toString(),
        destinationChainId: destChain.chainId.toString(),
        originCurrency,
        destinationCurrency: destCurrency,
        amount,
        user,
      });
      const res = await fetch(`/api/bridge?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bridge quote failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [amount, user, originChain, destChain, originCurrency, destCurrency]);

  return (
    <Card>
      <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "20px" }}>
        Bridge Tokens
      </h2>

      <div style={{ display: "grid", gap: "16px" }}>
        {/* Origin Chain */}
        <div>
          <Label>Origin Chain</Label>
          <select
            style={selectStyle}
            value={originChain.chainId}
            onChange={e => handleOriginChange(Number(e.target.value))}
          >
            {BRIDGE_CHAINS.map(c => (
              <option key={c.chainId} value={c.chainId}>{c.name} ({c.chainId})</option>
            ))}
          </select>
        </div>

        {/* Origin Token */}
        <div>
          <Label>Origin Token Address</Label>
          <input
            style={inputStyle}
            type="text"
            value={originCurrency}
            onChange={e => setOriginCurrency(e.target.value)}
            placeholder="0x..."
          />
        </div>

        {/* Arrow */}
        <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "18px" }}>
          ↓
        </div>

        {/* Dest Chain */}
        <div>
          <Label>Destination Chain</Label>
          <select
            style={selectStyle}
            value={destChain.chainId}
            onChange={e => handleDestChange(Number(e.target.value))}
          >
            {BRIDGE_CHAINS.map(c => (
              <option key={c.chainId} value={c.chainId}>{c.name} ({c.chainId})</option>
            ))}
          </select>
        </div>

        {/* Dest Token */}
        <div>
          <Label>Destination Token Address</Label>
          <input
            style={inputStyle}
            type="text"
            value={destCurrency}
            onChange={e => setDestCurrency(e.target.value)}
            placeholder="0x..."
          />
        </div>

        {/* Amount */}
        <div>
          <Label>Amount (smallest unit)</Label>
          <input
            style={inputStyle}
            type="text"
            placeholder="e.g. 1000000 (= 1 USDC)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        {/* User address */}
        <div>
          <Label>Your Address</Label>
          <input
            style={inputStyle}
            type="text"
            value={user}
            onChange={e => setUser(e.target.value)}
            placeholder="0x... (auto-fills from wallet)"
          />
        </div>

        {/* Button */}
        <button
          style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}
          onClick={handleBridgeQuote}
          disabled={loading || !amount || !user}
        >
          {loading ? "Fetching…" : "Get Bridge Quote"}
        </button>

        {/* Error */}
        {error && (
          <p style={{ color: "var(--error)", fontSize: "13px" }}>{error}</p>
        )}

        {/* Result */}
        {result && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Bridge quote
            </p>
            {result.amountOut && (
              <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)" }}>
                {result.amountOut} <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>out</span>
              </p>
            )}
            {result.estimatedTime && (
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                Estimated time: {result.estimatedTime}s
              </p>
            )}
            <CodeBlock data={result} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
function ActivityLog() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"swaps" | "bridges">("swaps");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/history?address=${address}&limit=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load history");
      setHistory(data.swaps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--bg-secondary)" : "transparent",
    border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    color: active ? "var(--text-primary)" : "var(--text-tertiary)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  return (
    <Card style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600 }}>LLM Activity</h2>
          <div style={{ display: "flex", gap: "4px" }}>
            <button style={tabStyle(tab === "swaps")} onClick={() => setTab("swaps")}>Swaps</button>
            <button style={tabStyle(tab === "bridges")} onClick={() => setTab("bridges")}>Bridges</button>
          </div>
        </div>
        <ConnectButton />
      </div>

      {tab === "swaps" && (
        <>
          {!isConnected && (
            <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>
              Connect your wallet to view recent swap events.
            </p>
          )}

          {isConnected && (
            <>
              <button
                style={{ ...btnSecondary, width: "auto", padding: "8px 20px", marginBottom: "16px" }}
                onClick={loadHistory}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load Swaps"}
              </button>

              {error && <p style={{ color: "var(--error)", fontSize: "13px" }}>{error}</p>}

              {history.length === 0 && !loading && !error && (
                <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
                  No swap events found in the last 10,000 blocks.
                </p>
              )}

              {history.map((item, i) => (
                <div
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "12px 0",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--accent)", fontFamily: "monospace" }}>
                      {item.txHash.slice(0, 14)}…
                    </span>
                    <span style={{ color: "var(--text-tertiary)" }}>block #{item.blockNumber}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Pool: <span style={{ fontFamily: "monospace" }}>{item.pool.slice(0, 12)}…</span>
                  </div>
                  <div style={{ color: "var(--text-tertiary)", marginTop: "2px" }}>
                    amount0: {item.amount0} · amount1: {item.amount1}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === "bridges" && (
        <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
          Bridge history not yet indexed. Use the Bridge form to get a cross-chain quote.
        </p>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", position: "relative" }}>
      <SakuraLeaves />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>xclaw-swap</span>
          <span
            style={{
              fontSize: "11px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              borderRadius: "4px",
              padding: "2px 8px",
              color: "var(--text-tertiary)",
            }}
          >
            Monad UV3
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a
            href="./SKILL.md"
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "6px 12px",
            }}
          >
            Skill Docs
          </a>
        </div>
      </header>

      {/* Hero */}
      <div
        className="animate-fade-up"
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "60px 24px 40px",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 700,
            background: "var(--gradient)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "12px",
          }}
        >
          Bot Swap Router
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px", maxWidth: "480px", margin: "0 auto 8px" }}>
          Uniswap V3 on Monad — mainnet &amp; testnet. 0.5% commission via split calldata.
        </p>
        <p style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>
          No x402 payment gate · Open API · Bot &amp; wallet friendly
        </p>
      </div>

      {/* Main grid */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px 80px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
        }}
      >
        <SwapForm />
        <BridgeForm />
        <ActivityLog />
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "24px",
          borderTop: "1px solid var(--border)",
          color: "var(--text-tertiary)",
          fontSize: "12px",
        }}
      >
        xclaw-swap · Monad Uniswap V3 · 0.5% commission ·{" "}
        <a href="https://github.com/ivaavimusic/x402-Layer-Clawhub-Skill" style={{ color: "var(--accent)" }}>
          GitHub
        </a>
      </footer>
    </div>
  );
}
