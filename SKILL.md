---
name: xclaw-swap
version: 1.0.0
description: |
  Monad Uniswap V3 swap router and cross-chain bridge. Execute token swaps on Monad mainnet or testnet,
  bridge tokens cross-chain via Relay Protocol, and get price predictions.
  0.5% service commission collected via split calldata (fee_tx + swap_tx).
  Triggers: "swap tokens", "uniswap swap", "monad swap", "token exchange", "swap WMON", "swap USDC",
    "bridge tokens", "cross-chain bridge", "bridge from monad", "bridge USDC", "relay bridge"
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

# xclaw-swap — Uniswap V3 Swap Router on Monad

xclaw-swap provides **Uniswap V3 token swap calldata** for Monad mainnet and testnet.
A **0.5% service commission** is collected via split calldata — no x402 payment gate.

**Network:** Monad Mainnet (chainId 143) or Testnet (chainId 10143)
**Protocol:** Uniswap V3
**Commission:** 0.5% via `fee_tx` + `swap_tx` calldata

---

## Quick Start

### 1. Set Environment Variables

```bash
export MONAD_NETWORK=testnet        # "mainnet" → production
export PAY_TO_ADDRESS=0xYOUR_WALLET # 0.5% commission recipient
export PORT=3001                    # avoid conflict with x402-defi-copilot
```

### 2. Install & Run

```bash
cd xclaw-swap
npm install
npm run dev
# Server: http://localhost:3001
```

### 3. Mainnet

```bash
MONAD_NETWORK=mainnet PAY_TO_ADDRESS=0xYOUR_WALLET npm run dev
```

---

## API Endpoints

### `GET /api/quote`

Get a Uniswap V3 price quote.

**Params:** `tokenIn`, `tokenOut`, `amountIn` (wei), `feeTier` (default: 3000)

```bash
curl "http://localhost:3001/api/quote?\
tokenIn=0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701&\
tokenOut=0x534b2f3A21130d7a60830c2Df862319e593943A3&\
amountIn=1000000000000000000&\
feeTier=3000"
```

**Response:**
```json
{
  "tokenIn": "0x760AfE...",
  "tokenOut": "0x534b2f...",
  "amountIn": "1000000000000000000",
  "amountOut": "502100",
  "feeTier": 3000,
  "quoterUsed": true,
  "fallback": false,
  "method": "quoterV2",
  "priceImpactBps": 0,
  "gasEstimate": "150000",
  "network": "testnet"
}
```

**`method` field values:**
- `"quoterV2"` — on-chain QuoterV2 contract returned the price (most accurate)
- `"slot0"` — price computed from pool `slot0` sqrtPriceX96 (off-chain math, no QuoterV2 needed). A `note` field is included.
- `"none"` — no pool found or QuoterV2 unavailable. A `warning` field is included.

> **Note:** If `fallback: true`, QuoterV2 is not deployed on testnet.
> Set `UV3_QUOTER_TESTNET=<address>` env to enable on-chain quotes.

---

### `POST /api/swap`

Build split calldata for a swap with 0.5% commission.

**Body:**
```json
{
  "tokenIn": "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
  "tokenOut": "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  "amountIn": "1000000000000000000",
  "feeTier": 3000,
  "recipient": "0xYOUR_ADDRESS",
  "slippageBps": 100
}
```

**Response:**
```json
{
  "tokenIn": "0x760AfE...",
  "tokenOut": "0x534b2f...",
  "amountIn": "1000000000000000000",
  "feeTier": 3000,
  "recipient": "0xYOUR...",
  "slippageBps": 100,
  "amountOutMinimum": "497058",
  "network": "testnet",
  "router": "0x9a0a7f...",
  "calldata": {
    "approve_tx": {
      "to": "0x760AfE...",
      "data": "0x095ea7b3...",
      "value": "0",
      "description": "Approve router to spend 995000000000000000 of tokenIn"
    },
    "fee_tx": {
      "to": "0x760AfE...",
      "data": "0xa9059cbb...",
      "value": "0",
      "description": "Transfer 5000000000000000 (0.5% commission) to PAY_TO_ADDRESS"
    },
    "swap_tx": {
      "to": "0x9a0a7f...",
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

### `GET /api/bridge`

Get a cross-chain bridge quote via Relay Protocol.

**Params:** `originChainId`, `destinationChainId`, `originCurrency`, `destinationCurrency`, `amount`, `user`, `recipient?`

```bash
curl "http://localhost:3001/api/bridge?\
originChainId=10143&\
destinationChainId=1&\
originCurrency=0x534b2f3A21130d7a60830c2Df862319e593943A3&\
destinationCurrency=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&\
amount=1000000&\
user=0xYOUR_ADDRESS"
```

**Response:**
```json
{
  "originChainId": 10143,
  "destinationChainId": 1,
  "amountOut": "998500",
  "fees": {
    "gas": "0.002",
    "relay": "1500"
  },
  "estimatedTime": 120,
  "steps": [
    { "action": "approve", "description": "Approve relay contract" },
    { "action": "bridge", "description": "Initiate cross-chain transfer" }
  ]
}
```

> **Note:** Bridge quotes depend on Relay Protocol support. If Monad testnet is not
> supported by Relay, you'll receive a 502 error with details.

---

### `GET /api/predict`

Get a price prediction for a token pair (stub — returns neutral baseline).

**Params:** `tokenIn`, `tokenOut`, `amountIn` (wei), `feeTier` (default: 3000)

```bash
curl "http://localhost:3001/api/predict?\
tokenIn=0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701&\
tokenOut=0x534b2f3A21130d7a60830c2Df862319e593943A3&\
amountIn=1000000000000000000&\
feeTier=3000"
```

**Response:**
```json
{
  "tokenIn": "0x760AfE...",
  "tokenOut": "0x534b2f...",
  "amountIn": "1000000000000000000",
  "currentQuote": "502100",
  "method": "slot0",
  "prediction": {
    "direction": "neutral",
    "confidence": 0.5,
    "priceImpactBps": 0,
    "horizon": "5m",
    "model": "stub-v0",
    "note": "Prediction model not yet deployed. Returns neutral baseline."
  },
  "feeTier": 3000,
  "network": "testnet"
}
```

> **Note:** The predict endpoint currently returns a stub response with `model: "stub-v0"`.
> Future versions will include ML-based price direction predictions.

---

### `GET /api/history`

Get recent Uniswap V3 swap events for a wallet.

**Params:** `address`, `limit?` (default 20, max 100)

```bash
curl "http://localhost:3001/api/history?address=0xYOUR_ADDRESS&limit=10"
```

**Response:**
```json
{
  "address": "0xYOUR_ADDRESS",
  "count": 3,
  "limit": 10,
  "swaps": [
    {
      "txHash": "0xabc...",
      "blockNumber": "12345678",
      "pool": "0xpool...",
      "sender": "0xrouter...",
      "recipient": "0xYOUR_ADDRESS",
      "amount0": "-1000000000000000000",
      "amount1": "502100",
      "sqrtPriceX96": "...",
      "network": "testnet"
    }
  ]
}
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

## Chain Config

| Parameter | Testnet | Mainnet |
|-----------|---------|---------|
| Chain ID | 10143 | 143 |
| RPC | testnet-rpc.monad.xyz | rpc.monad.xyz |
| UV3 Factory | 0x961235… | 0x204fac… |
| UV3 Router | 0x9a0a7f… | 0xd6145b… |
| UV3 Quoter | (set via env) | 0x661e93… |
| WMON | 0x760AfE… | 0x3bd359… |
| USDC | 0x534b2f… | 0x754704… |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONAD_NETWORK` | No | `testnet` | `"testnet"` or `"mainnet"` |
| `PAY_TO_ADDRESS` | Yes | — | 0.5% commission recipient address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | — | WalletConnect project ID for UI |
| `UV3_QUOTER_TESTNET` | No | — | Testnet QuoterV2 contract address |
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
