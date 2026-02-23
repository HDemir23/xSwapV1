---
name: xclaw-swap
version: 2.0.0
description: |
  Multi-chain Uniswap V3 swap router and cross-chain bridge. Execute token swaps on Ethereum,
  Arbitrum, Base, Optimism, Polygon, and Monad via a unified API. Bridge tokens cross-chain via
  Relay Protocol. 0.5% service commission collected via split calldata (fee_tx + swap_tx).
  Triggers: "swap tokens", "uniswap swap", "monad swap", "token exchange", "swap WETH", "swap USDC",
    "bridge tokens", "cross-chain bridge", "bridge from monad", "bridge USDC", "relay bridge",
    "swap on arbitrum", "swap on base", "swap on optimism", "swap on polygon"
homepage: https://github.com/ivaavimusic/x402-Layer-Clawhub-Skill
metadata:
  clawdbot:
    emoji: "⚡"
    homepage: https://github.com/ivaavimusic/x402-Layer-Clawhub-Skill
    os:
      - linux
      - darwin
    requires:
      bins:
        - node
        - curl
      env:
        - PAY_TO_ADDRESS
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# xclaw-swap — Multi-Chain Uniswap V3 Swap Router

xclaw-swap provides **Uniswap V3 token swap calldata** across multiple EVM chains.
A **0.5% service commission** is collected via split calldata — no x402 payment gate.

**Supported Chains:** Ethereum (1), Arbitrum (42161), Base (8453), Optimism (10), Polygon (137), Monad (143)
**Protocol:** Uniswap V3 (SwapRouter02) — same ABIs, different addresses per chain
**Commission:** 0.5% via `fee_tx` + `swap_tx` calldata

---

## Quick Start

### 1. Set Environment Variables

```bash
export PAY_TO_ADDRESS=0xYOUR_WALLET   # 0.5% commission recipient
export DEFAULT_CHAIN_ID=1             # optional, default: Ethereum
export PORT=3001                      # avoid conflict with x402-defi-copilot
```

### 2. Install & Run

```bash
cd xclaw-swap
npm install
npm run dev
# Server: http://localhost:3001
```

---

## Supported Chains

| Chain | Chain ID | Router | Quoter | WETH/Native | USDC |
|-------|----------|--------|--------|-------------|------|
| Ethereum | 1 | 0x68b346... | 0x61fFE0... | 0xC02aaA... (WETH) | 0xA0b869... |
| Arbitrum | 42161 | 0x68b346... | 0x61fFE0... | 0x82aF49... (WETH) | 0xaf88d0... |
| Base | 8453 | 0x262666... | 0x3d4e44... | 0x420000... (WETH) | 0x833589... |
| Optimism | 10 | 0x68b346... | 0x61fFE0... | 0x420000... (WETH) | 0x0b2C63... |
| Polygon | 137 | 0x68b346... | 0x61fFE0... | 0x0d500B... (WMATIC) | 0x3c499c... |
| Monad | 143 | 0xfe31f7... | 0x661e93... | 0x3bd359... (WMON) | 0x754704... |

All chains use Uniswap V3 standard ABIs (SwapRouter02, QuoterV2, Factory).

---

## API Endpoints

### `GET /api/chains`

List all supported chains.

```bash
curl "http://localhost:3001/api/chains"
```

**Response:**
```json
{
  "count": 6,
  "chains": [
    { "chainId": 1, "name": "Ethereum", "nativeSymbol": "ETH", "explorer": "https://etherscan.io", "rpc": "https://eth.drpc.org" },
    { "chainId": 42161, "name": "Arbitrum", ... },
    { "chainId": 8453, "name": "Base", ... },
    { "chainId": 10, "name": "Optimism", ... },
    { "chainId": 137, "name": "Polygon", ... },
    { "chainId": 143, "name": "Monad", ... }
  ]
}
```

---

### `GET /api/quote`

Get a Uniswap V3 price quote on any supported chain.

**Params:** `tokenIn`, `tokenOut`, `amountIn` (wei), `feeTier` (default: 3000), `chainId` (default: 1)

```bash
# Ethereum: WETH → USDC
curl "http://localhost:3001/api/quote?\
chainId=1&\
tokenIn=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&\
tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&\
amountIn=1000000000000000000&\
feeTier=3000"

# Monad: WMON → USDC
curl "http://localhost:3001/api/quote?\
chainId=143&\
tokenIn=0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A&\
tokenOut=0x754704Bc059F8C67012fEd69BC8A327a5aafb603&\
amountIn=1000000000000000000&\
feeTier=3000"
```

**Response:**
```json
{
  "tokenIn": "0xC02aaA...",
  "tokenOut": "0xA0b869...",
  "amountIn": "1000000000000000000",
  "amountOut": "2150340000",
  "feeTier": 3000,
  "quoterUsed": true,
  "fallback": false,
  "method": "quoterV2",
  "priceImpactBps": 0,
  "gasEstimate": "150000",
  "chainId": 1,
  "network": "ethereum"
}
```

**`method` field values:**
- `"quoterV2"` — on-chain QuoterV2 contract returned the price (most accurate)
- `"slot0"` — price computed from pool `slot0` sqrtPriceX96 (off-chain math fallback). A `note` field is included.
- `"none"` — no pool found. A `warning` field is included.

---

### `POST /api/swap`

Build split calldata for a swap with 0.5% commission.

**Body:**
```json
{
  "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "tokenOut": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amountIn": "1000000000000000000",
  "feeTier": 3000,
  "recipient": "0xYOUR_ADDRESS",
  "slippageBps": 100,
  "chainId": 1
}
```

**Response:**
```json
{
  "tokenIn": "0xC02aaA...",
  "tokenOut": "0xA0b869...",
  "amountIn": "1000000000000000000",
  "feeTier": 3000,
  "recipient": "0xYOUR...",
  "slippageBps": 100,
  "amountOutMinimum": "2129000000",
  "chainId": 1,
  "network": "ethereum",
  "router": "0x68b346...",
  "calldata": {
    "approve_tx": {
      "to": "0xC02aaA...",
      "data": "0x095ea7b3...",
      "value": "0",
      "description": "Approve router to spend 995000000000000000 of tokenIn"
    },
    "fee_tx": {
      "to": "0xC02aaA...",
      "data": "0xa9059cbb...",
      "value": "0",
      "description": "Transfer 5000000000000000 (0.5% commission) to PAY_TO_ADDRESS"
    },
    "swap_tx": {
      "to": "0x68b346...",
      "data": "0x414bf389...",
      "value": "0",
      "description": "Uniswap V3 exactInputSingle — swap 995000000000000000 tokenIn → tokenOut"
    },
    "commission": {
      "bps": 50,
      "feeAmount": "5000000000000000",
      "swapAmount": "995000000000000000",
      "payTo": "0xPAY_TO_ADDRESS"
    }
  },
  "execution_order": [
    "1. Execute approve_tx — approve router to spend swapAmount",
    "2. Execute fee_tx — transfer 0.5% commission to xclaw-swap",
    "3. Execute swap_tx — router performs the Uniswap V3 swap"
  ]
}
```

**Bot execution sequence:**
```python
# Using viem / ethers / web3:
# 1. wallet.sendTransaction(calldata.approve_tx)
# 2. wallet.sendTransaction(calldata.fee_tx)
# 3. wallet.sendTransaction(calldata.swap_tx)
```

---

### `GET /api/tokens`

Get tradeable tokens for a specific chain. Uses Uniswap token list for EVM chains, BFS factory scanning for Monad.

**Params:** `chainId` (default: 1)

```bash
curl "http://localhost:3001/api/tokens?chainId=1"
curl "http://localhost:3001/api/tokens?chainId=143"
```

**Response:**
```json
{
  "chainId": 1,
  "network": "ethereum",
  "count": 250,
  "tokens": [
    { "address": "0xC02aaA...", "symbol": "WETH", "name": "Wrapped Ether", "decimals": 18, "chainId": 1 },
    { "address": "0xA0b869...", "symbol": "USDC", "name": "USD Coin", "decimals": 6, "chainId": 1 }
  ]
}
```

---

### `GET /api/bridge`

Get a cross-chain bridge quote via Relay Protocol.

**Params:** `originChainId`, `destinationChainId`, `originCurrency`, `destinationCurrency`, `amount`, `user`, `recipient?`

```bash
curl "http://localhost:3001/api/bridge?\
originChainId=143&\
destinationChainId=1&\
originCurrency=0x754704Bc059F8C67012fEd69BC8A327a5aafb603&\
destinationCurrency=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&\
amount=1000000&\
user=0xYOUR_ADDRESS"
```

---

### `GET /api/predict`

Get a price prediction for a token pair (stub — returns neutral baseline).

**Params:** `tokenIn`, `tokenOut`, `amountIn` (wei), `feeTier` (default: 3000), `chainId` (default: 1)

---

### `GET /api/history`

Get recent Uniswap V3 swap events for a wallet.

**Params:** `address`, `limit?` (default 20, max 100), `chainId` (default: 1)

```bash
curl "http://localhost:3001/api/history?address=0xYOUR_ADDRESS&limit=10&chainId=1"
```

---

## Commission Model

| Field | Value |
|-------|-------|
| Commission | 0.5% (50 bps) |
| Fee token | tokenIn |
| Fee recipient | `PAY_TO_ADDRESS` env |
| Method | Direct `transfer()` before swap |
| Swap uses | 99.5% of amountIn |

The commission is collected **before** the swap — no smart contract required.
The bot executes 3 transactions: approve → fee_tx → swap_tx.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAY_TO_ADDRESS` | Yes | — | 0.5% commission recipient address |
| `DEFAULT_CHAIN_ID` | No | `1` | Default chain when `chainId` param omitted |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | — | WalletConnect project ID for UI |
| `PORT` | No | `3001` | Server port |

---

## Security Notice

> This skill generates calldata only — no private keys are handled server-side.
> All transaction signing happens in the bot or wallet.
> Always verify calldata before broadcasting to mainnet.

---

## Related

- [xClaw DeFi Copilot](../SKILL.md) — x402-gated DeFi insights
- [Relay Protocol](https://relay.link) — cross-chain bridge
- [Uniswap V3](https://docs.uniswap.org/concepts/protocol/swaps) — protocol docs
