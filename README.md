<p align="center">
  <img src="packages/mini-app/public/logo.jpg" width="80" height="80" style="border-radius: 16px" />
</p>

<h1 align="center">StarkZap</h1>

<p align="center">
  <strong>Full-Stack Starknet DeFi Platform</strong><br/>
  Telegram Mini App + Bot + Backend
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#deployment">Deployment</a> &bull;
  <a href="#security">Security</a> &bull;
  <a href="#api-reference">API Reference</a>
</p>

---

## Overview

StarkZap is a production-grade Starknet DeFi platform delivered through Telegram. It combines a **React Mini App**, a **Hono API backend**, and a **grammy Telegram bot** into a monorepo that provides every major DeFi primitive: token swaps, staking, lending, DCA orders, cross-chain bridging, and privacy-preserving transfers.

Every feature works through both the Mini App UI and directly from Telegram bot commands. Users get a non-custodial Starknet wallet created automatically on first interaction.

**Built with the [StarkZap SDK](https://www.npmjs.com/package/starkzap) v2.0.0** &mdash; all on-chain data is real, sourced from mainnet contracts.

---

## Features

### Wallet
- **Auto-generated Starknet wallet** per Telegram user (OpenZeppelin account)
- **Per-user encrypted key storage** (AES-256-GCM with HKDF-derived keys)
- **72 tokens** from StarkZap SDK presets with real-time USD prices from AVNU
- **Account deployment** with user-pays gas mode
- **Portfolio view** with total USD value

### Trading
- **Token Swaps** via AVNU aggregator + Ekubo DEX with configurable slippage (0.5%&ndash;5%)
- **Swap simulation** (preflight) before execution to catch errors
- **Fee estimation** shown alongside quotes
- **Provider selection** between AVNU and Ekubo

### Earning
- **Staking** across 138+ validators with real on-chain APY (11.15% STRK from minting curve)
- **5 stakeable tokens**: STRK, WBTC, tBTC, SolvBTC, LBTC
- **Claim rewards** and **unstake** with exit intent flow
- **Lending** on Vesu protocol &mdash; 50 markets across 10 pools
- **Deposit, withdraw, borrow, repay** with health factor monitoring
- **Max borrow calculation** from on-chain oracle prices + LTV ratios

### DCA (Dollar-Cost Averaging)
- **Recurring buy orders** via AVNU and Ekubo TWAMM
- **Configurable frequency**: hourly, 12h, daily, weekly
- **Cycle preview** with estimated output per execution
- **Order management**: create, cancel, view status + trade history

### Cross-Chain Bridge
- **Ethereum bridging** via WalletConnect (MetaMask, Rainbow, Trust, 300+ wallets)
- **Solana bridging** support (Hyperlane)
- **Bridge token discovery** from StarkGate API
- **Multiple protocols**: Canonical, CCTP, OFT, Hyperlane

### Privacy (Tongo Protocol)
- **Confidential transfers** using zero-knowledge proofs on Starknet
- **7 supported tokens**: STRK, ETH, WBTC, USDC, USDC.e, USDT, DAI
- **Fund / Transfer / Withdraw** with live mainnet contracts
- **Address-based recipient resolution** for platform users

### Telegram Bot
- **24 commands** covering every Mini App feature
- **Interactive step-by-step flows** with inline keyboard buttons
- **Direct transaction execution** from chat (swap, send, stake, lend, DCA)
- **Real-time data**: balances, prices, APY, positions, health factor
- **No Mini App required** &mdash; full DeFi from bot commands alone

---

## Architecture

```
starkzap-tg/
├── packages/
│   ├── backend/          Hono API server (59 endpoints)
│   │   ├── src/
│   │   │   ├── index.ts              Server entry, route mounting, rate limiting
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts           JWT + initData validation + HMAC bot auth
│   │   │   ├── routes/
│   │   │   │   ├── portfolio.ts      Balance queries with USD prices
│   │   │   │   ├── swap.ts           Swap quotes + execution + advanced (8 endpoints)
│   │   │   │   ├── staking.ts        Stake/claim/unstake + management (11 endpoints)
│   │   │   │   ├── staking-public.ts Validators, pools, APY (public, no auth)
│   │   │   │   ├── lending.ts        Vesu deposit/withdraw/borrow/repay (11 endpoints)
│   │   │   │   ├── dca.ts            DCA create/cancel/orders/preview
│   │   │   │   ├── bridge.ts         Bridge token discovery + fee estimation
│   │   │   │   ├── confidential.ts   Tongo fund/transfer/withdraw + resolve
│   │   │   │   ├── transfer.ts       Single + batch transfers
│   │   │   │   ├── advanced.ts       Deploy, sign message
│   │   │   │   ├── tokens.ts         Token list from SDK
│   │   │   │   ├── prices.ts         USD prices from AVNU quotes
│   │   │   │   └── history.ts        Transaction history
│   │   │   ├── services/
│   │   │   │   ├── starkzap.ts       SDK init, wallet management, encryption
│   │   │   │   ├── db.ts             SQLite access layer
│   │   │   │   ├── tokens.ts         Token resolution + caching
│   │   │   │   └── prices.ts         AVNU price fetching + cache
│   │   │   ├── db/
│   │   │   │   └── schema.sql        Database schema
│   │   │   └── utils/
│   │   │       └── logger.ts         Structured logging
│   │   └── package.json
│   │
│   ├── mini-app/         React Telegram Mini App
│   │   ├── src/
│   │   │   ├── App.tsx               Router, auth, layout
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx          Portfolio dashboard
│   │   │   │   ├── Swap.tsx          Token swap with quotes + slippage
│   │   │   │   ├── Stake.tsx         Validator selection, APY, positions
│   │   │   │   ├── Lend.tsx          Vesu markets, deposit/borrow/repay
│   │   │   │   ├── DCA.tsx           DCA order creation + management
│   │   │   │   ├── Bridge.tsx        WalletConnect + bridge execution
│   │   │   │   ├── Send.tsx          Normal, batch, confidential transfers
│   │   │   │   └── Activity.tsx      Transaction history with explorer links
│   │   │   ├── components/           Reusable UI components
│   │   │   ├── hooks/                Telegram, wallet, token hooks
│   │   │   ├── lib/
│   │   │   │   ├── api.ts            49 API functions + auto-refresh
│   │   │   │   └── format.ts         Display formatters
│   │   │   └── styles/
│   │   │       └── telegram.css      Design system
│   │   ├── vercel.json               Vercel deployment config
│   │   └── package.json
│   │
│   ├── bot/              Telegram Bot (grammy)
│   │   ├── src/
│   │   │   ├── index.ts              Bot setup, 24 commands, callback routing
│   │   │   ├── commands/             17 command handlers with interactive flows
│   │   │   ├── keyboards.ts          Inline keyboard layouts
│   │   │   └── utils/
│   │   │       ├── backend.ts        HMAC-signed API client
│   │   │       └── state.ts          Conversation state management
│   │   └── package.json
│   │
│   └── shared/           Shared types + config
│       └── src/
│           ├── types.ts              TypeScript interfaces
│           ├── config.ts             Network + DCA config
│           └── tokens.ts             Token presets
│
├── scripts/
│   └── migrate-keys.ts   Key rotation migration script
├── render.yaml            Render deployment blueprint
├── .env.example           Environment variable template
└── package.json           Workspace root
```

### Data Flow

```
Telegram User
    │
    ├── Mini App (React SPA)
    │       │
    │       └── API calls ──► Backend (Hono)
    │                              │
    │                              ├── StarkZap SDK ──► Starknet RPC
    │                              ├── AVNU Paymaster
    │                              ├── SQLite (users, transactions)
    │                              └── AVNU API (prices)
    │
    └── Bot Commands (grammy)
            │
            └── HMAC-signed API calls ──► Backend (same)
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Vite + Tailwind CSS | 18.3 / 6.3 / 4.1 |
| **Backend** | Hono + @hono/node-server | 4.12 |
| **Bot** | grammy | 1.41 |
| **Blockchain** | StarkZap SDK + starknet.js | 2.0.0 / 9.2 |
| **Database** | better-sqlite3 (WAL mode) | 11.8 |
| **Auth** | JWT (jose) + Telegram HMAC | 6.0 |
| **Rate Limiting** | hono-rate-limiter | 0.5.3 |
| **Privacy** | @fatsolutions/tongo-sdk | 1.4.0 |
| **Bridge** | @walletconnect/ethereum-provider | 2.23 |
| **State** | Zustand + React Query | 5.0 / 5.75 |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
git clone https://github.com/collinsville22/Starkzapbot.git
cd Starkzapbot
npm install
```

### Configuration

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token from BotFather |
| `JWT_SECRET` | 64-char hex string (`openssl rand -hex 32`) |
| `ENCRYPTION_KEY` | 64-char hex string (`openssl rand -hex 32`) |
| `STARKNET_RPC_URL` | Starknet RPC endpoint |

### Running Locally

Start all three services:

```bash
# Terminal 1: Backend
npx tsx packages/backend/src/index.ts

# Terminal 2: Bot
npx tsx packages/bot/src/index.ts

# Terminal 3: Frontend
cd packages/mini-app && npx vite
```

The backend runs on `http://localhost:3001`, frontend on `http://localhost:5173`.

### Setting Up Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Set the Mini App URL: BotFather &rarr; `/mybots` &rarr; Bot Settings &rarr; Menu Button &rarr; your ngrok/Vercel URL
3. Add your `BOT_TOKEN` to `.env`

---

## Deployment

### Recommended: Vercel (Frontend) + Render (Backend + Bot)

**Frontend on Vercel:**

```bash
cd packages/mini-app
vercel deploy --prod
```

The `vercel.json` rewrites `/api/*` and `/auth/*` to your Render backend URL. Update the destination URLs in `vercel.json` after deploying the backend.

**Backend + Bot on Render:**

Push to GitHub, then connect the repo to Render. The `render.yaml` blueprint configures:

- **Web Service** (`starkzap-backend`): Hono API with persistent disk for SQLite
- **Worker** (`starkzap-bot`): grammy bot with long-polling

Set environment variables in the Render dashboard (marked `sync: false` in the blueprint).

### Environment Variables for Production

| Variable | Frontend | Backend | Bot |
|----------|----------|---------|-----|
| `BOT_TOKEN` | | &check; | &check; |
| `JWT_SECRET` | | &check; | |
| `ENCRYPTION_KEY` | | &check; | |
| `STARKNET_RPC_URL` | | &check; | |
| `CORS_ORIGIN` | | &check; | |
| `MINI_APP_URL` | | &check; | &check; |
| `DB_PATH` | | &check; | |
| `BACKEND_URL` | | | &check; |
| `VITE_WALLETCONNECT_PROJECT_ID` | &check; | | |

---

## Security

### Encryption

User private keys are encrypted at rest using **AES-256-GCM** with per-user key derivation:

```
Master Key (ENCRYPTION_KEY env var)
    │
    └── HKDF-SHA256(masterKey, salt="starkzap-user-{telegramId}", info="starkzap-wallet-key")
            │
            └── 32-byte AES key unique to this user
                    │
                    └── AES-256-GCM(privateKey, randomIV) → stored as iv:authTag:ciphertext
```

Compromising one user's derived key does not expose other users.

### Authentication

| Method | Used By | Mechanism |
|--------|---------|-----------|
| **initData HMAC** | Mini App | Telegram-signed data verified with bot token |
| **bot-hmac** | Bot commands | `HMAC-SHA256(botToken, telegramId:timestamp)` &mdash; bot token never transmitted |
| **JWT** | All authenticated requests | 24-hour expiration, HS256 |

### Rate Limiting

| Tier | Limit | Scope |
|------|-------|-------|
| Global | 100 req / 15 min | Per IP |
| Auth | 10 req / 1 min | Per IP |
| Authenticated | 60 req / 1 min | Per user |

### Replay Prevention

Both initData hashes and bot-hmac nonces are tracked in memory with automatic expiry. Each authentication payload can only be used once.

### Key Rotation

A migration script re-encrypts all user keys atomically:

```bash
OLD_ENCRYPTION_KEY=... NEW_ENCRYPTION_KEY=... npx tsx scripts/migrate-keys.ts
```

---

## API Reference

### Public Endpoints (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/tokens` | All supported tokens |
| GET | `/api/prices` | USD prices from AVNU |
| GET | `/api/staking/validators/quick` | 138+ validators with logos |
| GET | `/api/staking/apy` | On-chain STRK APY + BTC rewards |
| GET | `/api/staking/tokens` | Stakeable tokens |

### Authenticated Endpoints (JWT Required)

| Category | Endpoints | Key Operations |
|----------|-----------|----------------|
| **Portfolio** | 1 | Balances + USD values |
| **Swap** | 8 | Quote, execute, preflight, fee estimate, providers |
| **Staking** | 15 | Stake, claim, unstake, positions, validators, pools |
| **Lending** | 11 | Deposit, withdraw, borrow, repay, markets, health, max borrow |
| **DCA** | 4 | Create, cancel, list orders, preview cycle |
| **Transfer** | 2 | Single send, batch transfer |
| **Bridge** | 2 | Token discovery, fee estimation |
| **Confidential** | 7 | Fund, transfer, withdraw, balance, resolve, my-id, info |
| **Advanced** | 3 | Deploy account, deploy status, sign message |
| **History** | 1 | Transaction log with type filter |

**Total: 59 endpoints**

---

## Bot Commands

| Command | Description | Mode |
|---------|-------------|------|
| `/balance` | Token balances + USD | Data |
| `/price ETH` | Live token price | Data |
| `/address` | Wallet address + explorer link | Data |
| `/portfolio` | Full portfolio summary | Data |
| `/swap` | Interactive swap (or `/swap ETH USDC 0.5`) | Execute |
| `/send` | Interactive send (or `/send 0x... 10 STRK`) | Execute |
| `/stake` | Stake/claim/unstake with validator selection | Execute |
| `/lend` | Deposit/withdraw/borrow/repay on Vesu | Execute |
| `/dca` | Create/cancel DCA orders | Execute |
| `/private` | Tongo confidential transfers | Execute |
| `/validators` | Browse + search validators | Data |
| `/position` | Staking + lending positions | Data |
| `/health USDC ETH` | Lending health factor | Data |
| `/history` | Transaction history (filterable) | Data |
| `/deploy` | Deploy Starknet account | Execute |
| `/help` | All commands reference | Info |

All execute commands support both **interactive mode** (step-by-step buttons) and **quick mode** (single-line with arguments).

---

## On-Chain Data Sources

All financial data is sourced from live Starknet mainnet contracts:

| Data | Source Contract | Method |
|------|----------------|--------|
| STRK APY | Minting Curve `0x00ca1705...` | `yearly_mint()` / `get_total_stake()` |
| BTC Rewards | Reward Supplier `0x009035...` | `get_alpha()` |
| Token Prices | AVNU DEX | Swap quote (10-unit) |
| Validator Commission | Pool Contracts | `Staking.getCommission()` |
| Lending APY | Vesu Pools | `market.stats.supplyApy` |
| Max Borrow | Vesu Pools | On-chain `price()` + `pair_config()` |
| Tongo Contracts | 7 per-token addresses | `getState()`, `fund()`, `transfer()` |

---

## License

MIT

---

<p align="center">
  Built with <a href="https://www.npmjs.com/package/starkzap">StarkZap SDK</a> on <a href="https://www.starknet.io">Starknet</a>
</p>
