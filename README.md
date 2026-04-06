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

- Swap once
- Bridge once
- Send once

Official capability reference:

- App Kit: https://docs.arc.network/app-kit

Community app example:

- XyloNet: https://www.xylonet.xyz/

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
