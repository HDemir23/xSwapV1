"use client";

import { memo, useMemo } from "react";
import { Header } from "@/components/Header";

const ApiEndpoint = memo(function ApiEndpoint({
  method,
  path,
  description,
  params,
  example,
  response,
}: {
  method: "GET" | "POST";
  path: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
  example?: string;
  response?: string;
}) {
  return (
    <div className="api-section">
      <div className="api-header">
        <span className={`api-method ${method.toLowerCase()}`}>{method}</span>
        <code className="api-path">{path}</code>
      </div>
      <p className="api-desc">{description}</p>
      {params && params.length > 0 && (
        <div className="api-params">
          <strong>Params:</strong>
          <ul>
            {params.map((p) => (
              <li key={p.name}>
                <code>{p.name}</code> ({p.type}) — {p.desc}
              </li>
            ))}
          </ul>
        </div>
      )}
      {example && (
        <div className="api-example">
          <strong>Example:</strong>
          <pre>{example}</pre>
        </div>
      )}
      {response && (
        <div className="api-response">
          <strong>Response:</strong>
          <pre>{response}</pre>
        </div>
      )}
    </div>
  );
});

const EnvTable = memo(function EnvTable({
  items,
}: {
  items: { name: string; required: boolean; default: string; desc: string }[];
}) {
  return (
    <table className="env-table">
      <thead>
        <tr>
          <th>Variable</th>
          <th>Required</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.name}>
            <td>
              <code>{item.name}</code>
            </td>
            <td>{item.required ? "Yes" : "No"}</td>
            <td>{item.default || "\u2014"}</td>
            <td>{item.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

const ChainTable = memo(function ChainTable() {
  const rows = useMemo(
    () => [
      { chain: "Ethereum", chainId: "1", router: "0x68b346...", quoter: "0x61fFE0...", weth: "0xC02aaA...", usdc: "0xA0b869..." },
      { chain: "Arbitrum", chainId: "42161", router: "0x68b346...", quoter: "0x61fFE0...", weth: "0x82aF49...", usdc: "0xaf88d0..." },
      { chain: "Base", chainId: "8453", router: "0x262666...", quoter: "0x3d4e44...", weth: "0x420000...", usdc: "0x833589..." },
      { chain: "Optimism", chainId: "10", router: "0x68b346...", quoter: "0x61fFE0...", weth: "0x420000...", usdc: "0x0b2C63..." },
      { chain: "Polygon", chainId: "137", router: "0x68b346...", quoter: "0x61fFE0...", weth: "0x0d500B... (WMATIC)", usdc: "0x3c499c..." },
      { chain: "Monad", chainId: "143", router: "0xfe31f7...", quoter: "0x661e93...", weth: "0x3bd359... (WMON)", usdc: "0x754704..." },
    ],
    [],
  );

  return (
    <table className="chain-table">
      <thead>
        <tr>
          <th>Chain</th>
          <th>ID</th>
          <th>Router</th>
          <th>Quoter</th>
          <th>Wrapped Native</th>
          <th>USDC</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.chainId}>
            <td>{row.chain}</td>
            <td>{row.chainId}</td>
            <td>{row.router}</td>
            <td>{row.quoter}</td>
            <td>{row.weth}</td>
            <td>{row.usdc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export default function DocsPage() {
  return (
    <div className="page-container">
      <Header activePage="docs" />
      <main className="docs-main">
        <div className="docs-content">
          <header className="docs-header">
            <h1>xclaw-swap API Docs</h1>
            <p>
              Multi-chain Uniswap V3 swap router. Supports Ethereum, Arbitrum, Base,
              Optimism, Polygon, and Monad. 0.5% commission via split calldata.
            </p>
          </header>

          <section className="docs-section">
            <h2>Quick Start</h2>
            <div className="code-block">
              <pre>{`# Set environment
export PAY_TO_ADDRESS=0xYOUR_WALLET
export DEFAULT_CHAIN_ID=1  # optional, default: 1 (Ethereum)

# Install & run
npm install
npm run dev
# Server: http://localhost:3001`}</pre>
            </div>
          </section>

          <section className="docs-section">
            <h2>API Endpoints</h2>

            <ApiEndpoint
              method="GET"
              path="/api/chains"
              description="List all supported chains."
              response={`{
  "count": 6,
  "chains": [
    { "chainId": 1, "name": "Ethereum", "nativeSymbol": "ETH", "explorer": "https://etherscan.io" },
    { "chainId": 42161, "name": "Arbitrum", ... },
    { "chainId": 8453, "name": "Base", ... },
    { "chainId": 10, "name": "Optimism", ... },
    { "chainId": 137, "name": "Polygon", ... },
    { "chainId": 143, "name": "Monad", ... }
  ]
}`}
            />

            <ApiEndpoint
              method="GET"
              path="/api/quote"
              description="Get a Uniswap V3 price quote on any supported chain."
              params={[
                {
                  name: "tokenIn",
                  type: "address",
                  desc: "Input token address",
                },
                {
                  name: "tokenOut",
                  type: "address",
                  desc: "Output token address",
                },
                { name: "amountIn", type: "string", desc: "Amount in wei" },
                {
                  name: "feeTier",
                  type: "number",
                  desc: "Fee tier (default: 3000)",
                },
                {
                  name: "chainId",
                  type: "number",
                  desc: "Chain ID (default: 1)",
                },
              ]}
              example={`# Ethereum: WETH → USDC
curl "http://localhost:3001/api/quote?\\
chainId=1&\\
tokenIn=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&\\
tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&\\
amountIn=1000000000000000000&feeTier=3000"

# Monad: WMON → USDC
curl "http://localhost:3001/api/quote?\\
chainId=143&\\
tokenIn=0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A&\\
tokenOut=0x754704Bc059F8C67012fEd69BC8A327a5aafb603&\\
amountIn=1000000000000000000&feeTier=3000"`}
              response={`{
  "amountOut": "2150340000",
  "feeTier": 3000,
  "method": "quoterV2",
  "chainId": 1,
  "network": "ethereum"
}`}
            />

            <ApiEndpoint
              method="POST"
              path="/api/swap"
              description="Build split calldata for a swap with 0.5% commission."
              params={[
                { name: "tokenIn", type: "address", desc: "Input token" },
                { name: "tokenOut", type: "address", desc: "Output token" },
                { name: "amountIn", type: "string", desc: "Amount in wei" },
                { name: "feeTier", type: "number", desc: "Fee tier" },
                {
                  name: "recipient",
                  type: "address",
                  desc: "Recipient address",
                },
                {
                  name: "slippageBps",
                  type: "number",
                  desc: "Slippage in basis points",
                },
                {
                  name: "chainId",
                  type: "number",
                  desc: "Chain ID (default: 1)",
                },
              ]}
              example={`curl -X POST http://localhost:3001/api/swap \\
  -H "Content-Type: application/json" \\
  -d '{
    "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "tokenOut": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amountIn": "1000000000000000000",
    "feeTier": 3000,
    "recipient": "0xYOUR_ADDRESS",
    "slippageBps": 100,
    "chainId": 1
  }'`}
              response={`{
  "calldata": {
    "approve_tx": { "to": "...", "data": "..." },
    "fee_tx": { "to": "...", "data": "..." },
    "swap_tx": { "to": "...", "data": "..." },
    "commission": { "bps": 50, "feeAmount": "..." }
  },
  "execution_order": ["1. approve_tx", "2. fee_tx", "3. swap_tx"],
  "chainId": 1,
  "network": "ethereum"
}`}
            />

            <ApiEndpoint
              method="GET"
              path="/api/tokens"
              description="Get tradeable tokens for a chain. Uses Uniswap token list (EVM chains) or BFS discovery (Monad)."
              params={[
                {
                  name: "chainId",
                  type: "number",
                  desc: "Chain ID (default: 1)",
                },
              ]}
              example={`curl "http://localhost:3001/api/tokens?chainId=1"
curl "http://localhost:3001/api/tokens?chainId=143"`}
              response={`{
  "chainId": 1,
  "network": "ethereum",
  "count": 250,
  "tokens": [
    { "address": "0xC02a...", "symbol": "WETH", "name": "Wrapped Ether", "decimals": 18 },
    { "address": "0xA0b8...", "symbol": "USDC", "name": "USD Coin", "decimals": 6 },
    ...
  ]
}`}
            />

            <ApiEndpoint
              method="GET"
              path="/api/bridge"
              description="Get a cross-chain bridge quote via Relay Protocol."
              params={[
                {
                  name: "originChainId",
                  type: "number",
                  desc: "Source chain ID",
                },
                {
                  name: "destinationChainId",
                  type: "number",
                  desc: "Dest chain ID",
                },
                {
                  name: "originCurrency",
                  type: "address",
                  desc: "Source token",
                },
                {
                  name: "destinationCurrency",
                  type: "address",
                  desc: "Dest token",
                },
                { name: "amount", type: "string", desc: "Amount" },
                { name: "user", type: "address", desc: "User address" },
              ]}
              response={`{
  "amountOut": "998500",
  "estimatedTime": 120,
  "steps": [...]
}`}
            />

            <ApiEndpoint
              method="GET"
              path="/api/history"
              description="Get recent Uniswap V3 swap events for a wallet."
              params={[
                { name: "address", type: "address", desc: "Wallet address" },
                {
                  name: "limit",
                  type: "number",
                  desc: "Max results (default: 20)",
                },
                {
                  name: "chainId",
                  type: "number",
                  desc: "Chain ID (default: 1)",
                },
              ]}
              response={`{
  "swaps": [{
    "txHash": "0x...",
    "blockNumber": "12345678",
    "pool": "0x...",
    "amount0": "-1000000000000000000",
    "amount1": "502100",
    "chainId": 1
  }]
}`}
            />

            <ApiEndpoint
              method="GET"
              path="/api/predict"
              description="Price prediction stub (returns neutral baseline)."
              params={[
                { name: "tokenIn", type: "address", desc: "Input token" },
                { name: "tokenOut", type: "address", desc: "Output token" },
                { name: "amountIn", type: "string", desc: "Amount in wei" },
                { name: "feeTier", type: "number", desc: "Fee tier" },
                { name: "chainId", type: "number", desc: "Chain ID (default: 1)" },
              ]}
              response={`{
  "currentQuote": "2150340000",
  "prediction": { "direction": "neutral", "confidence": 0.5, "model": "stub-v0" },
  "chainId": 1
}`}
            />
          </section>

          <section className="docs-section">
            <h2>Commission Model</h2>
            <table className="info-table">
              <tbody>
                <tr>
                  <td>Commission</td>
                  <td>0.5% (50 bps)</td>
                </tr>
                <tr>
                  <td>Fee token</td>
                  <td>tokenIn</td>
                </tr>
                <tr>
                  <td>Fee recipient</td>
                  <td>PAY_TO_ADDRESS env</td>
                </tr>
                <tr>
                  <td>Method</td>
                  <td>Direct transfer() before swap</td>
                </tr>
                <tr>
                  <td>Swap uses</td>
                  <td>99.5% of amountIn</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="docs-section">
            <h2>Supported Chains</h2>
            <ChainTable />
          </section>

          <section className="docs-section">
            <h2>Environment Variables</h2>
            <EnvTable
              items={[
                {
                  name: "PAY_TO_ADDRESS",
                  required: true,
                  default: "",
                  desc: "0.5% commission recipient",
                },
                {
                  name: "DEFAULT_CHAIN_ID",
                  required: false,
                  default: "1",
                  desc: "Default chain when chainId param omitted",
                },
                {
                  name: "PORT",
                  required: false,
                  default: "3001",
                  desc: "Server port",
                },
                {
                  name: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
                  required: false,
                  default: "",
                  desc: "WalletConnect project ID",
                },
              ]}
            />
          </section>

          <section className="docs-section warning">
            <h2>Security Notice</h2>
            <p>
              This skill generates calldata only — no private keys are handled
              server-side. All transaction signing happens in the bot or wallet.
              <strong>
                {" "}
                Always verify calldata before broadcasting to mainnet.
              </strong>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
