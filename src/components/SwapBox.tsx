"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain, useReadContract, useBalance, useSendTransaction, usePublicClient } from "wagmi";
import { formatUnits, parseUnits } from "viem";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Token {
  symbol: string;
  address: string;  // "native" for ETH/MON/MATIC
  decimals: number;
  name?: string;
  logoURI?: string;
}

interface ChainInfo {
  chainId: number;
  name: string;
  nativeSymbol: string;
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

// ─── Execution state ────────────────────────────────────────────────────────

interface TxStep {
  key: string;
  description: string;
  status: "pending" | "signing" | "confirming" | "done" | "error";
  hash?: string;
}

interface ExecutionState {
  steps: TxStep[];
  currentStep: number;
  done: boolean;
  error?: string;
}

const CHAIN_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  42161: "https://arbiscan.io",
  8453: "https://basescan.org",
  10: "https://optimistic.etherscan.io",
  137: "https://polygonscan.com",
  143: "https://monadexplorer.com",
};

// ─── Chain → WETH mapping (for native→wrapped API calls) ────────────────────

const NATIVE_TO_WRAPPED: Record<number, string> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  8453: "0x4200000000000000000000000000000000000006",
  10: "0x4200000000000000000000000000000000000006",
  137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  143: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
};

function resolveApiAddress(address: string, chainId: number): string {
  if (address === "native") return NATIVE_TO_WRAPPED[chainId] ?? address;
  return address;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

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

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function useTokenBalance(
  token: Token | undefined,
  walletAddress: string | undefined,
  chainId: number,
) {
  const isNative = token?.address === "native";

  // Native balance (ETH/MON/MATIC)
  const { data: nativeData, isLoading: nativeLoading, refetch: nativeRefetch } = useBalance({
    address: walletAddress as `0x${string}`,
    chainId,
    query: { enabled: isNative && !!walletAddress },
  });

  // ERC20 balance
  const { data: erc20Data, isLoading: erc20Loading, refetch: erc20Refetch } = useReadContract({
    address: (token?.address ?? "0x") as `0x${string}`,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId,
    query: { enabled: !isNative && !!token?.address && !!walletAddress },
  });

  if (isNative) {
    return {
      balance: nativeData?.value,
      isLoading: nativeLoading,
      refetch: nativeRefetch,
    };
  }

  return {
    balance: erc20Data as bigint | undefined,
    isLoading: erc20Loading,
    refetch: erc20Refetch,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBalance(balance: bigint, decimals: number): string {
  const formatted = formatUnits(balance, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(4);
  if (num < 1_000_000) return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatDisplayAmount(weiAmount: string, decimals: number): string {
  if (!weiAmount || weiAmount === "0") return "0";
  try {
    const formatted = formatUnits(BigInt(weiAmount), decimals);
    const num = parseFloat(formatted);
    if (num === 0) return "0";
    if (num < 0.000001) return "<0.000001";
    // Show up to 6 significant decimals
    return num.toLocaleString("en-US", { maximumFractionDigits: 6 });
  } catch {
    return weiAmount;
  }
}

// ─── Token Logo ─────────────────────────────────────────────────────────────

const TokenLogo = memo(function TokenLogo({
  token,
  size = 28,
}: {
  token: Token;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [token.logoURI]);

  if (!token.logoURI || failed) {
    // Letter circle fallback
    return (
      <div
        className="token-logo-fallback"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {token.symbol.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={token.logoURI}
      alt={token.symbol}
      width={size}
      height={size}
      className="token-logo-img"
      onError={() => setFailed(true)}
    />
  );
});

// ─── Token Selector Modal ───────────────────────────────────────────────────

const POPULAR_SYMBOLS = ["ETH", "MON", "MATIC", "USDC", "USDT", "DAI", "WBTC"];

const TokenModal = memo(function TokenModal({
  tokens,
  walletAddress,
  chainId,
  onSelect,
  onClose,
}: {
  tokens: Token[];
  walletAddress: string | undefined;
  chainId: number;
  onSelect: (token: Token) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!search) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        (t.name?.toLowerCase().includes(q) ?? false) ||
        t.address.toLowerCase().includes(q),
    );
  }, [tokens, search]);

  const popular = useMemo(
    () => tokens.filter((t) => POPULAR_SYMBOLS.includes(t.symbol)),
    [tokens],
  );

  return (
    <div className="token-modal-overlay" onClick={onClose}>
      <div className="token-modal" onClick={(e) => e.stopPropagation()}>
        <div className="token-modal-header">
          <span>Select a token</span>
          <button className="token-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="token-modal-search">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!search && popular.length > 0 && (
          <div className="token-modal-popular">
            {popular.map((t) => (
              <button
                key={t.address}
                className="popular-chip"
                onClick={() => onSelect(t)}
              >
                <TokenLogo token={t} size={20} />
                {t.symbol}
              </button>
            ))}
          </div>
        )}

        <div className="token-modal-divider" />

        <div className="token-modal-list">
          {filtered.map((t) => (
            <TokenRow
              key={t.address}
              token={t}
              walletAddress={walletAddress}
              chainId={chainId}
              onSelect={onSelect}
            />
          ))}
          {filtered.length === 0 && (
            <div className="token-modal-empty">No tokens found</div>
          )}
        </div>
      </div>
    </div>
  );
});

const TokenRow = memo(function TokenRow({
  token,
  walletAddress,
  chainId,
  onSelect,
}: {
  token: Token;
  walletAddress: string | undefined;
  chainId: number;
  onSelect: (token: Token) => void;
}) {
  const { balance, isLoading } = useTokenBalance(token, walletAddress, chainId);

  return (
    <button className="token-row" onClick={() => onSelect(token)}>
      <TokenLogo token={token} size={36} />
      <div className="token-row-info">
        <span className="token-row-symbol">{token.symbol}</span>
        <span className="token-row-name">{token.name ?? token.symbol}</span>
      </div>
      <div className="token-row-balance">
        {isLoading
          ? "..."
          : balance !== undefined
            ? formatBalance(balance, token.decimals)
            : ""}
      </div>
    </button>
  );
});

// ─── Sub-components ─────────────────────────────────────────────────────────

const PERCENT_OPTIONS = [
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "MAX", value: 100 },
] as const;

const BalanceBar = memo(function BalanceBar({
  balance,
  decimals,
  symbol,
  isLoading,
  onPercent,
}: {
  balance: bigint | undefined;
  decimals: number;
  symbol: string;
  isLoading: boolean;
  onPercent: (percent: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="balance-bar">
        <span className="balance-text">Balance: ...</span>
      </div>
    );
  }

  if (balance === undefined) return null;

  return (
    <div className="balance-bar">
      <span className="balance-text">
        Balance: {formatBalance(balance, decimals)} {symbol}
      </span>
      {balance > 0n && (
        <div className="percent-buttons">
          {PERCENT_OPTIONS.map((p) => (
            <button
              key={p.value}
              className="percent-btn"
              onClick={() => onPercent(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const FEE_TIERS = [
  { label: "0.01%", value: 100 },
  { label: "0.05%", value: 500 },
  { label: "0.30%", value: 3000 },
  { label: "1.00%", value: 10000 },
] as const;

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

// Token selector button (replaces <select>)
const TokenSelectorButton = memo(function TokenSelectorButton({
  token,
  onClick,
}: {
  token: Token | undefined;
  onClick: () => void;
}) {
  if (!token) {
    return (
      <button className="token-selector-btn" onClick={onClick}>
        Select
        <span className="token-selector-chevron">&#x25BE;</span>
      </button>
    );
  }

  return (
    <button className="token-selector-btn" onClick={onClick}>
      <TokenLogo token={token} size={24} />
      <span className="token-selector-symbol">{token.symbol}</span>
      <span className="token-selector-chevron">&#x25BE;</span>
    </button>
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

const ExecutionPanel = memo(function ExecutionPanel({
  execution,
  chainId,
  onClose,
}: {
  execution: ExecutionState;
  chainId: number;
  onClose: () => void;
}) {
  const explorer = CHAIN_EXPLORERS[chainId] ?? "";

  return (
    <div className="result-panel">
      <div className="result-header">
        <span>{execution.done ? "Swap Complete" : "Executing Swap..."}</span>
        {execution.done && (
          <button className="close-btn" onClick={onClose}>
            x
          </button>
        )}
      </div>
      <div className="execution-steps">
        {execution.steps.map((step, i) => (
          <div key={step.key} className={`execution-step execution-step--${step.status}`}>
            <div className="execution-step-icon">
              {step.status === "done" && "\u2713"}
              {step.status === "error" && "\u2717"}
              {step.status === "signing" && "\u270D"}
              {step.status === "confirming" && "\u23F3"}
              {step.status === "pending" && (i + 1)}
            </div>
            <div className="execution-step-info">
              <span className="execution-step-label">
                {step.status === "signing" ? "Sign in wallet..." : step.description}
              </span>
              {step.hash && explorer && (
                <a
                  className="execution-step-tx"
                  href={`${explorer}/tx/${step.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {step.hash.slice(0, 10)}...{step.hash.slice(-8)}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {execution.error && (
        <p className="error-text">{execution.error}</p>
      )}
    </div>
  );
});

// ─── Main SwapBox ───────────────────────────────────────────────────────────

export const SwapBox = memo(function SwapBox() {
  const { address, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const chains = useChains();

  const [selectedChainId, setSelectedChainId] = useState(1);
  const { tokens, loading: tokensLoading } = useTokens(selectedChainId);

  const [tokenIn, setTokenIn] = useState("");
  const [tokenOut, setTokenOut] = useState("");

  // Human-readable amount (e.g. "1.5", NOT wei)
  const [amountIn, setAmountIn] = useState("");
  const [amountOutDisplay, setAmountOutDisplay] = useState("");
  const [feeTier, setFeeTier] = useState(3000);
  const [slippage, setSlippage] = useState("0.5");

  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [execution, setExecution] = useState<ExecutionState | null>(null);
  const [error, setError] = useState("");

  // Token modal state
  const [modalSide, setModalSide] = useState<"in" | "out" | null>(null);

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

  // Token metadata lookups
  const tokenInMeta = useMemo(
    () => tokens.find((t) => t.address === tokenIn),
    [tokens, tokenIn],
  );
  const tokenOutMeta = useMemo(
    () => tokens.find((t) => t.address === tokenOut),
    [tokens, tokenOut],
  );

  // Balance for tokenIn
  const { balance: tokenInBalance, isLoading: balanceLoading } = useTokenBalance(
    tokenInMeta,
    address,
    selectedChainId,
  );

  // Percent buttons → human-readable
  const handlePercent = useCallback(
    (percent: number) => {
      if (!tokenInBalance || tokenInBalance === 0n || !tokenInMeta) return;
      const amount = (tokenInBalance * BigInt(percent)) / 100n;
      const humanAmount = formatUnits(amount, tokenInMeta.decimals);
      setAmountIn(humanAmount);
      setAmountOutDisplay("");
      setResult(null);
    },
    [tokenInBalance, tokenInMeta],
  );

  const handleChainChange = useCallback(
    (newChainId: number) => {
      setSelectedChainId(newChainId);
      setAmountIn("");
      setAmountOutDisplay("");
      setResult(null);
      setError("");
      if (address && walletChainId !== newChainId) {
        switchChain?.({ chainId: newChainId });
      }
    },
    [address, walletChainId, switchChain],
  );

  // Input validation: only allow valid decimal numbers
  const handleAmountChange = useCallback((value: string) => {
    // Allow empty, digits, single decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmountIn(value);
      setAmountOutDisplay("");
      setResult(null);
    }
  }, []);

  // Convert human amount to wei for API
  const getAmountInWei = useCallback((): string | null => {
    if (!amountIn || !tokenInMeta) return null;
    try {
      return parseUnits(amountIn, tokenInMeta.decimals).toString();
    } catch {
      return null;
    }
  }, [amountIn, tokenInMeta]);

  const handleQuote = useCallback(async () => {
    const weiAmount = getAmountInWei();
    if (!weiAmount) return;
    setLoading(true);
    setError("");
    try {
      const apiTokenIn = resolveApiAddress(tokenIn, selectedChainId);
      const apiTokenOut = resolveApiAddress(tokenOut, selectedChainId);
      const res = await fetch(
        `/api/quote?tokenIn=${apiTokenIn}&tokenOut=${apiTokenOut}&amountIn=${weiAmount}&feeTier=${feeTier}&chainId=${selectedChainId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quote failed");
      // Display human-readable amountOut
      const outDecimals = tokenOutMeta?.decimals ?? 18;
      setAmountOutDisplay(formatDisplayAmount(data.amountOut, outDecimals));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getAmountInWei, tokenIn, tokenOut, feeTier, selectedChainId, tokenOutMeta]);

  const handleSwap = useCallback(async () => {
    const weiAmount = getAmountInWei();
    if (!weiAmount || !address) return;
    setLoading(true);
    setError("");
    setExecution(null);
    try {
      // 1. Get calldata from API
      const apiTokenIn = resolveApiAddress(tokenIn, selectedChainId);
      const apiTokenOut = resolveApiAddress(tokenOut, selectedChainId);
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenIn: apiTokenIn,
          tokenOut: apiTokenOut,
          amountIn: weiAmount,
          feeTier,
          recipient: address,
          slippageBps: Number(slippage) * 100,
          chainId: selectedChainId,
          isNativeIn: tokenIn === "native",
        }),
      });
      const data = await res.json() as SwapResult;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Swap failed");
      setResult(data);

      // 2. Build execution steps from execution_order
      const txMap: Record<string, { to: string; data: string; value: string; description: string }> = {
        approve_tx: data.calldata.approve_tx,
        fee_tx: data.calldata.fee_tx,
        swap_tx: data.calldata.swap_tx,
      };

      const steps: TxStep[] = data.execution_order.map((key) => ({
        key,
        description: txMap[key]?.description ?? key,
        status: "pending" as const,
      }));

      setExecution({ steps, currentStep: 0, done: false });

      // 3. Execute each transaction sequentially
      for (let i = 0; i < steps.length; i++) {
        const stepKey = steps[i].key;
        const txData = txMap[stepKey];
        if (!txData) continue;

        // Mark as "signing"
        setExecution((prev) => {
          if (!prev) return prev;
          const updated = [...prev.steps];
          updated[i] = { ...updated[i], status: "signing" };
          return { ...prev, steps: updated, currentStep: i };
        });

        // Send transaction via wallet (triggers wallet popup)
        const hash = await sendTransactionAsync({
          to: txData.to as `0x${string}`,
          data: txData.data as `0x${string}`,
          value: BigInt(txData.value || "0"),
          chainId: selectedChainId,
        });

        // Mark as "confirming"
        setExecution((prev) => {
          if (!prev) return prev;
          const updated = [...prev.steps];
          updated[i] = { ...updated[i], status: "confirming", hash };
          return { ...prev, steps: updated };
        });

        // Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
          });
        }

        // Mark as "done"
        setExecution((prev) => {
          if (!prev) return prev;
          const updated = [...prev.steps];
          updated[i] = { ...updated[i], status: "done" };
          return { ...prev, steps: updated };
        });
      }

      // All done
      setExecution((prev) => prev ? { ...prev, done: true } : prev);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      // Mark current step as error
      setExecution((prev) => {
        if (!prev) return prev;
        const updated = [...prev.steps];
        if (updated[prev.currentStep]) {
          updated[prev.currentStep] = { ...updated[prev.currentStep], status: "error" };
        }
        return { ...prev, steps: updated, error: message };
      });
    } finally {
      setLoading(false);
    }
  }, [getAmountInWei, tokenIn, tokenOut, feeTier, address, slippage, selectedChainId, sendTransactionAsync, publicClient]);

  const flipTokens = useCallback(() => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setAmountOutDisplay("");
    setResult(null);
  }, [tokenIn, tokenOut]);

  const closeResult = useCallback(() => {
    setResult(null);
    setExecution(null);
  }, []);

  const isSwapReady = useMemo(() => amountOutDisplay && !result, [amountOutDisplay, result]);

  const currentChainName = useMemo(
    () => chains.find((c) => c.chainId === selectedChainId)?.name ?? "Chain",
    [chains, selectedChainId],
  );

  // Token modal handlers
  const openModalIn = useCallback(() => setModalSide("in"), []);
  const openModalOut = useCallback(() => setModalSide("out"), []);
  const closeModal = useCallback(() => setModalSide(null), []);

  const handleTokenSelect = useCallback(
    (token: Token) => {
      if (modalSide === "in") {
        // If selecting the same as tokenOut, swap them
        if (token.address === tokenOut) {
          setTokenOut(tokenIn);
        }
        setTokenIn(token.address);
      } else {
        if (token.address === tokenIn) {
          setTokenIn(tokenOut);
        }
        setTokenOut(token.address);
      }
      setAmountOutDisplay("");
      setResult(null);
      setModalSide(null);
    },
    [modalSide, tokenIn, tokenOut],
  );

  const isQuoteDisabled = !amountIn || !tokenIn || !tokenOut || loading || tokensLoading;

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
              inputMode="decimal"
              placeholder="0"
              value={amountIn}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
          </div>
          <TokenSelectorButton token={tokenInMeta} onClick={openModalIn} />
        </div>

        {address && tokenInMeta && (
          <BalanceBar
            balance={tokenInBalance}
            decimals={tokenInMeta.decimals}
            symbol={tokenInMeta.symbol}
            isLoading={balanceLoading}
            onPercent={handlePercent}
          />
        )}

        <button
          className="flip-button"
          onClick={flipTokens}
          aria-label="Flip tokens"
        >
          &#x2193;
        </button>

        <div className="input-row">
          <div className="input-amount">
            <input type="text" placeholder="0" value={amountOutDisplay} readOnly />
          </div>
          <TokenSelectorButton token={tokenOutMeta} onClick={openModalOut} />
        </div>

        {error && <p className="error-text">{error}</p>}

        {!address ? (
          <div className="connect-wrapper">
            <ConnectButton />
          </div>
        ) : execution ? (
          <ExecutionPanel
            execution={execution}
            chainId={selectedChainId}
            onClose={closeResult}
          />
        ) : (
          <button
            className="swap-button"
            onClick={isSwapReady ? handleSwap : handleQuote}
            disabled={isQuoteDisabled}
          >
            {tokensLoading
              ? "Loading tokens..."
              : loading
                ? "Loading..."
                : isSwapReady
                  ? "Swap"
                  : "Quote"}
          </button>
        )}
      </div>

      <p className="swap-footer">
        0.5% fee &middot; {currentChainName} &middot; <a href="/docs">API Docs</a>
      </p>

      {modalSide && (
        <TokenModal
          tokens={tokens}
          walletAddress={address}
          chainId={selectedChainId}
          onSelect={handleTokenSelect}
          onClose={closeModal}
        />
      )}
    </div>
  );
});
