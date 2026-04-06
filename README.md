# Arc ERC-8183 Quickstart

This workspace now contains a runnable TypeScript version of Arc's official "Create Your First ERC-8183 Job" quickstart using Circle developer-controlled wallets.

Official docs:
- https://docs.arc.network/arc/tutorials/create-your-first-erc-8183-job

## Prerequisites

- Node.js 24+
- A Circle Developer API key
- Your registered Circle Entity Secret
- Arc Testnet USDC from the faucet

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env` file from the example:

   ```bash
   cp .env.example .env
   ```

3. Fill in:

   ```dotenv
   CIRCLE_API_KEY=YOUR_API_KEY
   CIRCLE_ENTITY_SECRET=YOUR_ENTITY_SECRET
   ```

4. Optional knobs:

   ```dotenv
   JOB_BUDGET_USDC=5
   PROVIDER_STARTER_BALANCE_USDC=1
   JOB_DESCRIPTION=ERC-8183 demo job on Arc Testnet
   ```

## Run

```bash
npm run start
```

The script will:

- create a wallet set and two Arc Testnet SCAs
- pause so you can fund the client wallet with testnet USDC
- transfer starter USDC to the provider wallet
- run `createJob`, `setBudget`, `approve`, `fund`, `submit`, and `complete`
- print explorer links and final balances
- save a shareable report under `.context/runs/<timestamp>/`

Generated files:

- `.context/runs/<timestamp>/report.json`
- `.context/runs/<timestamp>/summary.md`

Those artifacts are intended for the "specifics + visuals" writeup: job ID, tx hashes, elapsed times, and final balances are all recorded.

## Verify

```bash
npm run check
```

## App Kit Playground

This workspace also includes a small App Kit playground built around the official Viem adapter:

- `send()` on Arc Testnet
- `bridge()` between Sepolia and Arc Testnet
- `swap()` on mainnet chains supported by App Kit

Why start here:

- It is the shortest App Kit path that can reuse the Circle credentials already needed for the ERC-8183 flow.
- It follows the official App Kit quickstart shape.
- It can bootstrap a local wallet by funding it from an existing Arc Testnet wallet.
- It gives you a clean base to extend into bridge and swap flows later.

Official references:

- App Kit overview: https://docs.arc.network/app-kit
- Send quickstart: https://docs.arc.network/app-kit/quickstarts/send-tokens-same-chain
- Bridge with Circle Wallets: https://docs.arc.network/app-kit/quickstarts/bridge-with-circle-wallets
- Swap quickstart: https://docs.arc.network/app-kit/quickstarts/swap-tokens-same-chain

### App Kit Env

Add these to `.env`:

```dotenv
APP_KIT_FUNDER_WALLET_ADDRESS=YOUR_EXISTING_ARC_TESTNET_WALLET
APP_KIT_BOOTSTRAP_AMOUNT=1.00
APP_KIT_PRIVATE_KEY=YOUR_LOCAL_ARC_TESTNET_PRIVATE_KEY
APP_KIT_RECIPIENT_ADDRESS=YOUR_ARC_TESTNET_RECIPIENT_WALLET
APP_KIT_SEND_AMOUNT=0.10
APP_KIT_SEND_TOKEN=USDC
```

For swap, add:

```dotenv
KIT_KEY=YOUR_KIT_KEY
APP_KIT_SWAP_CHAIN=Ethereum
APP_KIT_SWAP_TOKEN_IN=USDC
APP_KIT_SWAP_TOKEN_OUT=USDT
APP_KIT_SWAP_AMOUNT_IN=1.00
APP_KIT_SWAP_SLIPPAGE_BPS=300
```

Important:

- App Kit `swap` is mainnet-only according to the official quickstart.
- In the current SDK build installed here, `kit.getSupportedChains("swap")` does not include `Arc_Testnet`.
- So this workspace supports `send` and `bridge` for Arc Testnet, but `swap` only for supported mainnet chains such as `Ethereum`.

### Bootstrap a Wallet

```bash
npm run appkit:bootstrap:wallet
```

This generates a local EOA private key, funds it with Arc Testnet USDC from your existing wallet, and writes a reusable env snippet under `.context/runs/app-kit-bootstrap-<timestamp>/wallet.env`.

If `APP_KIT_PRIVATE_KEY` is already set, the script reuses that wallet and sends additional Arc Testnet USDC to it instead of generating a new key.

### Bootstrap a Bridge Wallet

```bash
npm run appkit:bootstrap:bridge
```

This generates or reuses a local EOA private key, requests `native + USDC` on `Ethereum_Sepolia` through the Circle testnet faucet API, and writes a reusable env snippet under `.context/runs/app-kit-bridge-bootstrap-<timestamp>/wallet.env`.

If the faucet API returns `Forbidden`, the script still saves the generated wallet env so you can fund that Sepolia address manually and continue.

### Run App Kit Bridge

```bash
npm run appkit:bridge:arc
```

The bridge script:

- uses `@circle-fin/app-kit`
- uses `@circle-fin/adapter-viem-v2`
- estimates the bridge first
- bridges `USDC` between `Ethereum_Sepolia` and `Arc_Testnet`
- supports `APP_KIT_BRIDGE_FROM_CHAIN` and `APP_KIT_BRIDGE_TO_CHAIN`
- can use Circle's forwarder with `APP_KIT_BRIDGE_USE_FORWARDER=true`
- can route to your own `APP_KIT_BRIDGE_RECIPIENT_ADDRESS` on Arc
- writes artifacts under `.context/runs/app-kit-bridge-<timestamp>/`

### Run App Kit Send

```bash
npm run appkit:send:arc
```

The script:

- uses `@circle-fin/app-kit`
- uses `@circle-fin/adapter-viem-v2`
- estimates the send first
- executes `send()` on `Arc_Testnet`
- writes artifacts under `.context/runs/app-kit-send-<timestamp>/`

### Run App Kit Swap

```bash
npm run appkit:swap:mainnet
```

The swap script:

- uses `@circle-fin/app-kit`
- uses `@circle-fin/adapter-viem-v2`
- requires `KIT_KEY`
- estimates the swap first
- executes `swap()` on a supported mainnet chain
- writes artifacts under `.context/runs/app-kit-swap-<timestamp>/`

Default example:

- chain: `Ethereum`
- token in: `USDC`
- token out: `USDT`
- amount: `1.00`

If you set `APP_KIT_SWAP_CHAIN=Arc_Testnet`, the script fails fast with a clear message because App Kit swap support does not currently include Arc Testnet.

## Arc Testnet Activity Roadmap

Last checked: 2026-04-06

This repo currently focuses on the ERC-8183 escrow quickstart, but a broader Arc Testnet progression that makes sense for both ecosystem familiarity and possible retroactive rewards is:

1. Faucet
2. Swap / Bridge / Send
3. Mint / Domain / Simple Deploy
4. Community

Recommended pacing:

- Day 1: Faucet plus a few basic onchain actions
- Day 2: Mint, domain, or a tiny deploy
- Day 3+: Community participation plus a small build

Important caveats:

- A retrodrop or airdrop is not officially confirmed. Treat testnet activity as low-cost exploration, not guaranteed payout.
- The Arc Builders Fund is official and is the stronger reason to build something real if you want upside beyond simple activity.

### 1. Faucet

Start with funded wallets and a working Arc network connection.

- Arc Testnet faucet: https://faucet.circle.com
- Connect to Arc: https://docs.arc.network/arc/references/connect-to-arc
- Transfer USDC or EURC: https://docs.arc.network/arc/tutorials/transfer-usdc-or-eurc

### 2. Swap / Bridge / Send

Do not jump straight to LP creation. A wider set of simple actions is more useful at the start:

- Send once on Arc Testnet
- Bridge once to or from Arc Testnet
- Swap once on an App Kit-supported mainnet chain

Official capability reference:

- App Kit: https://docs.arc.network/app-kit

Community app example:

- XyloNet: https://www.xylonet.xyz/

Note:

- App Kit `swap` is mainnet-only right now. For Arc Testnet specifically, the supported path in this repo is `send + bridge`.

### 3. Mint / Domain / Simple Deploy

After basic wallet activity, leave a stronger builder footprint:

- Mint an NFT or claim a domain
- Deploy one simple contract
- Verify the contract on Arcscan

Official deployment references:

- Deploy on Arc: https://docs.arc.network/arc/tutorials/deploy-on-arc
- Interact with contracts: https://docs.arc.network/arc/tutorials/interact-with-contracts

### 4. Community

Pair onchain activity with visible community participation.

- Arc House: https://community.arc.network/
- Events: office hours, hackathons, ecosystem demos

Current community items checked on 2026-04-06:

- April 7, 2026: Arc Discord Office Hours
- April 14, 2026: Arc Discord Office Hours
- April 15, 2026: Building Agentic Commerce on Arc: VibeCard
- April 20-26, 2026: Agentic Economy on Arc Hackathon

### Why Arc Is Interesting

The technical angle that makes Arc worth testing is not just another EVM testnet checklist:

- USDC is used as the native gas token, which makes fees easier to reason about.
- Arc emphasizes deterministic, sub-second finality.
- Arc Testnet targets roughly $0.01 per transaction under normal conditions.

References:

- Gas and Fees: https://docs.arc.network/arc/references/gas-and-fees
- Deterministic Finality: https://docs.arc.network/arc/concepts/deterministic-finality

### Builder Angle

If you want to go beyond click-through activity, the best next step is to build something small but visible:

- A minimal USDC send app
- A bridge or swap frontend using App Kit
- An ERC-8183 escrow demo
- An AI agent registration plus payment flow

Official references:

- Register Your First AI Agent: https://docs.arc.network/arc/tutorials/register-your-first-ai-agent
- Create Your First ERC-8183 Job: https://docs.arc.network/arc/tutorials/create-your-first-erc-8183-job
- Access USDC Crosschain: https://docs.arc.network/arc/tutorials/access-usdc-crosschain
- Sample Applications: https://docs.arc.network/arc/references/sample-applications

### Funding and Ecosystem Notes

- Arc Builders Fund: https://www.circle.com/blog/introducing-the-arc-builders-fund
- Arc Community Hub: https://community.arc.network/

Working recommendation for this workspace:

1. Keep the ERC-8183 quickstart as the core proof-of-work.
2. Add one lightweight transfer or bridge flow.
3. Add one small public-facing writeup with screenshots and tx links.
