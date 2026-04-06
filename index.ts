import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "viem/chains";

type WalletLike = {
  id?: string;
  address?: string | null;
};

type StepRecord = {
  name: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

type TransactionRecord = StepRecord & {
  txHash: string;
  explorerUrl: string;
};

type RunReport = {
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  metrics?: {
    endToEndMs: number;
    escrowToSettlementMs?: number;
  };
  config: {
    budgetUsdc: string;
    providerStarterBalanceUsdc: string;
    jobDescription: string;
    chain: string;
    contractAddress: string;
  };
  walletSetId?: string;
  wallets: {
    client?: WalletLike;
    provider?: WalletLike;
  };
  job?: {
    id: string;
    status: string;
    deliverableHash: string;
    reasonHash: string;
  };
  steps: StepRecord[];
  transactions: TransactionRecord[];
  balances: Array<{
    label: string;
    address?: string | null;
    usdc: string;
  }>;
};

const REQUIRED_ENV = ["CIRCLE_API_KEY", "CIRCLE_ENTITY_SECRET"] as const;
const USDC_TOKEN_ADDRESS = "0x3600000000000000000000000000000000000000" as Address;
const AGENTIC_COMMERCE_CONTRACT =
  "0x0747EEf0706327138c69792bF28Cd525089e4583" as Address;
const STATUS_NAMES = [
  "Open",
  "Funded",
  "Submitted",
  "Completed",
  "Rejected",
  "Expired",
] as const;

const budgetUsdc = process.env.JOB_BUDGET_USDC ?? "5";
const providerStarterBalanceUsdc =
  process.env.PROVIDER_STARTER_BALANCE_USDC ?? "1";
const jobDescription =
  process.env.JOB_DESCRIPTION ?? "ERC-8183 demo job on Arc Testnet";

const JOB_BUDGET = parseUnits(budgetUsdc, 6);

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const agenticCommerceAbi = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "evaluator", type: "address" },
      { indexed: false, name: "expiredAt", type: "uint256" },
      { indexed: false, name: "hook", type: "address" },
    ],
    anonymous: false,
  },
] as const;

function nowIso() {
  return new Date().toISOString();
}

function durationMs(startedAt: number) {
  return Date.now() - startedAt;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function explorerTxUrl(txHash: Hex) {
  return `${arcTestnet.blockExplorers.default.url}/tx/${txHash}`;
}

function hasEnoughUsdc(balance: string, minimum: number) {
  const parsed = Number(balance);
  return Number.isFinite(parsed) && parsed >= minimum;
}

async function extractJobId(txHash: Hex) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: agenticCommerceAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "JobCreated") {
        return decoded.args.jobId;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not parse JobCreated event");
}

async function waitForTransaction(
  txId: string,
  label: string,
  report: RunReport,
) {
  const startedAt = Date.now();
  process.stdout.write(`  Waiting for ${label}`);

  for (let i = 0; i < 60; i += 1) {
    await delay(2000);
    const tx = await circleClient.getTransaction({ id: txId });
    const data = tx.data?.transaction;

    if (data?.state === "COMPLETE" && data.txHash) {
      const completedAt = nowIso();
      const txHash = data.txHash as Hex;
      const explorerUrl = explorerTxUrl(txHash);

      report.transactions.push({
        name: label,
        startedAt: new Date(startedAt).toISOString(),
        completedAt,
        durationMs: durationMs(startedAt),
        txHash,
        explorerUrl,
      });

      console.log(` ✓\n  Tx: ${explorerUrl}`);
      return txHash;
    }

    if (data?.state === "FAILED") {
      throw new Error(`${label} failed onchain`);
    }

    process.stdout.write(".");
  }

  throw new Error(`${label} timed out`);
}

async function recordStep<T>(
  report: RunReport,
  name: string,
  action: () => Promise<T>,
) {
  const startedAt = Date.now();
  const result = await action();

  report.steps.push({
    name,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: nowIso(),
    durationMs: durationMs(startedAt),
  });

  return result;
}

async function getUsdcBalance(wallet: WalletLike) {
  const balances = await circleClient.getWalletTokenBalance({ id: wallet.id! });
  const usdc = balances.data?.tokenBalances?.find(
    (tokenBalance) => tokenBalance.token?.symbol === "USDC",
  );
  return usdc?.amount ?? "0";
}

async function collectBalances(
  report: RunReport,
  wallets: Array<{ label: string } & WalletLike>,
) {
  console.log("\nBalances:");

  report.balances = [];

  for (const wallet of wallets) {
    const usdc = await getUsdcBalance(wallet);
    report.balances.push({
      label: wallet.label,
      address: wallet.address,
      usdc,
    });

    console.log(`  ${wallet.label}: ${wallet.address}`);
    console.log(`    USDC: ${usdc}`);
  }
}

async function waitForUsdcBalance(
  wallet: WalletLike,
  minimumUsdc: number,
  label: string,
) {
  process.stdout.write(`  Waiting for ${label} wallet funding`);

  for (let i = 0; i < 45; i += 1) {
    await delay(2000);
    const balance = await getUsdcBalance(wallet);

    if (hasEnoughUsdc(balance, minimumUsdc)) {
      console.log(` ✓\n  USDC balance: ${balance}`);
      return balance;
    }

    process.stdout.write(".");
  }

  throw new Error(`${label} wallet did not receive enough USDC in time`);
}

async function writeArtifacts(report: RunReport) {
  const timestamp = report.startedAt.replaceAll(":", "-");
  const runDir = resolve(process.cwd(), ".context", "runs", timestamp);
  await mkdir(runDir, { recursive: true });

  const summaryLines = [
    `# Arc ERC-8183 Run`,
    ``,
    `- Started: ${report.startedAt}`,
    `- Completed: ${report.completedAt ?? ""}`,
    `- Total duration: ${formatDuration(report.totalDurationMs ?? 0)}`,
    `- Escrow to settlement: ${
      report.metrics?.escrowToSettlementMs != null
        ? formatDuration(report.metrics.escrowToSettlementMs)
        : "n/a"
    }`,
    `- Budget: ${report.config.budgetUsdc} USDC`,
    `- Contract: ${report.config.contractAddress}`,
    `- Job ID: ${report.job?.id ?? ""}`,
    `- Final status: ${report.job?.status ?? ""}`,
    `- Client wallet: ${report.wallets.client?.address ?? ""}`,
    `- Provider wallet: ${report.wallets.provider?.address ?? ""}`,
    ``,
    `## Transactions`,
    ...report.transactions.map(
      (tx) =>
        `- ${tx.name}: ${tx.txHash} (${formatDuration(tx.durationMs)}) ${tx.explorerUrl}`,
    ),
    ``,
    `## Balances`,
    ...report.balances.map(
      (balance) =>
        `- ${balance.label}: ${balance.usdc} USDC (${balance.address ?? ""})`,
    ),
  ];

  await writeFile(
    resolve(runDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(resolve(runDir, "summary.md"), `${summaryLines.join("\n")}\n`, "utf8");

  console.log(`\nArtifacts written to: ${runDir}`);
}

async function main() {
  const startedAt = Date.now();
  const report: RunReport = {
    startedAt: new Date(startedAt).toISOString(),
    config: {
      budgetUsdc,
      providerStarterBalanceUsdc,
      jobDescription,
      chain: "ARC-TESTNET",
      contractAddress: AGENTIC_COMMERCE_CONTRACT,
    },
    wallets: {},
    steps: [],
    transactions: [],
    balances: [],
  };

  console.log("── Step 1: Create wallets ──");
  const walletSet = await recordStep(report, "create wallet set", async () =>
    circleClient.createWalletSet({ name: "ERC8183 Job Wallets" }),
  );
  report.walletSetId = walletSet.data?.walletSet?.id;

  const walletsResponse = await recordStep(report, "create wallets", async () =>
    circleClient.createWallets({
      blockchains: ["ARC-TESTNET"],
      count: 2,
      walletSetId: walletSet.data?.walletSet?.id ?? "",
      accountType: "SCA",
    }),
  );

  const clientWallet = walletsResponse.data?.wallets?.[0]!;
  const providerWallet = walletsResponse.data?.wallets?.[1]!;
  report.wallets.client = { id: clientWallet.id, address: clientWallet.address };
  report.wallets.provider = {
    id: providerWallet.id,
    address: providerWallet.address,
  };

  console.log("\n── Step 2: Fund the client wallet ──");
  console.log("  Client wallet:");
  console.log(`  Client: ${clientWallet.address}`);
  console.log(`  Wallet ID: ${clientWallet.id}`);
  console.log("  Public faucet:  https://faucet.circle.com");
  console.log("  Console faucet: https://console.circle.com/faucet");
  console.log("\n  The script will fund the provider wallet automatically.");

  const minimumClientUsdc = Number(budgetUsdc) + Number(providerStarterBalanceUsdc);

  try {
    await recordStep(report, "request client faucet funds", async () => {
      await circleClient.requestTestnetTokens({
        address: clientWallet.address!,
        blockchain: "ARC-TESTNET",
        usdc: true,
      });
    });

    await recordStep(report, "wait for client faucet funds", async () => {
      await waitForUsdcBalance(clientWallet, minimumClientUsdc, "client");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\n  Automatic faucet request failed: ${message}`);
    console.log("  Fund this wallet manually with Arc Testnet USDC, then continue.");

    const rl = createInterface({ input, output });
    await rl.question("\nPress Enter after the client wallet is funded... ");
    rl.close();

    await recordStep(report, "wait for manual client funding", async () => {
      await waitForUsdcBalance(clientWallet, minimumClientUsdc, "client");
    });
  }

  console.log("\n── Step 3: Transfer starter USDC to provider ──");
  const transferTx = await circleClient.createTransaction({
    walletAddress: clientWallet.address!,
    blockchain: "ARC-TESTNET",
    tokenAddress: USDC_TOKEN_ADDRESS,
    destinationAddress: providerWallet.address!,
    amount: [providerStarterBalanceUsdc],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  await waitForTransaction(
    transferTx.data?.id!,
    "transfer starter USDC to provider",
    report,
  );

  console.log("\n── Step 4: Check balances ──");
  await recordStep(report, "collect balances after transfer", async () => {
    await collectBalances(report, [
      { label: "Client", ...clientWallet },
      { label: "Provider", ...providerWallet },
    ]);
  });

  const block = await publicClient.getBlock();
  const expiredAt = block.timestamp + 3600n;

  console.log("\n── Step 5: Create job - createJob() ──");
  const createJobTx = await circleClient.createContractExecutionTransaction({
    walletAddress: clientWallet.address!,
    blockchain: "ARC-TESTNET",
    contractAddress: AGENTIC_COMMERCE_CONTRACT,
    abiFunctionSignature: "createJob(address,address,uint256,string,address)",
    abiParameters: [
      providerWallet.address!,
      clientWallet.address!,
      expiredAt.toString(),
      jobDescription,
      "0x0000000000000000000000000000000000000000",
    ],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const createJobTxHash = await waitForTransaction(
    createJobTx.data?.id!,
    "create job",
    report,
  );
  const jobId = await extractJobId(createJobTxHash);
  console.log(`  Job ID: ${jobId}`);

  console.log("\n── Step 6: Set budget - setBudget() ──");
  const setBudgetTx = await circleClient.createContractExecutionTransaction({
    walletAddress: providerWallet.address!,
    blockchain: "ARC-TESTNET",
    contractAddress: AGENTIC_COMMERCE_CONTRACT,
    abiFunctionSignature: "setBudget(uint256,uint256,bytes)",
    abiParameters: [jobId.toString(), JOB_BUDGET.toString(), "0x"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  await waitForTransaction(setBudgetTx.data?.id!, "set budget", report);

  console.log("\n── Step 7: Approve USDC - approve() ──");
  const approveTx = await circleClient.createContractExecutionTransaction({
    walletAddress: clientWallet.address!,
    blockchain: "ARC-TESTNET",
    contractAddress: USDC_TOKEN_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [AGENTIC_COMMERCE_CONTRACT, JOB_BUDGET.toString()],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  await waitForTransaction(approveTx.data?.id!, "approve USDC", report);

  console.log("\n── Step 8: Fund escrow - fund() ──");
  const fundStartedAt = Date.now();
  const fundTx = await circleClient.createContractExecutionTransaction({
    walletAddress: clientWallet.address!,
    blockchain: "ARC-TESTNET",
    contractAddress: AGENTIC_COMMERCE_CONTRACT,
    abiFunctionSignature: "fund(uint256,bytes)",
    abiParameters: [jobId.toString(), "0x"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  await waitForTransaction(fundTx.data?.id!, "fund escrow", report);

  console.log("\n── Step 9: Submit deliverable - submit() ──");
  const deliverableHash = keccak256(toHex("arc-erc8183-demo-deliverable"));
  const submitTx = await circleClient.createContractExecutionTransaction({
    walletAddress: providerWallet.address!,
    blockchain: "ARC-TESTNET",
    contractAddress: AGENTIC_COMMERCE_CONTRACT,
    abiFunctionSignature: "submit(uint256,bytes32,bytes)",
    abiParameters: [jobId.toString(), deliverableHash, "0x"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  await waitForTransaction(submitTx.data?.id!, "submit deliverable", report);

  console.log("\n── Step 10: Complete job - complete() ──");
  const reasonHash = keccak256(toHex("deliverable-approved"));
  const completeTx = await circleClient.createContractExecutionTransaction({
    walletAddress: clientWallet.address!,
    blockchain: "ARC-TESTNET",
    contractAddress: AGENTIC_COMMERCE_CONTRACT,
    abiFunctionSignature: "complete(uint256,bytes32,bytes)",
    abiParameters: [jobId.toString(), reasonHash, "0x"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  await waitForTransaction(completeTx.data?.id!, "complete job", report);

  console.log("\n── Step 11: Check final job state ──");
  const job = await recordStep(report, "read final job", async () =>
    publicClient.readContract({
      address: AGENTIC_COMMERCE_CONTRACT,
      abi: agenticCommerceAbi,
      functionName: "getJob",
      args: [jobId],
    }),
  );
  const status = STATUS_NAMES[Number(job.status)] ?? `Unknown (${job.status})`;

  report.job = {
    id: jobId.toString(),
    status,
    deliverableHash,
    reasonHash,
  };

  console.log(`  Job ID: ${jobId}`);
  console.log(`  Status: ${status}`);
  console.log(`  Budget: ${formatUnits(job.budget, 6)} USDC`);
  console.log(`  Hook: ${job.hook}`);
  console.log(`  Deliverable hash submitted: ${deliverableHash}`);

  console.log("\n── Step 12: Check final balances ──");
  await recordStep(report, "collect final balances", async () => {
    await collectBalances(report, [
      { label: "Client", ...clientWallet },
      { label: "Provider", ...providerWallet },
    ]);
  });

  report.completedAt = nowIso();
  report.totalDurationMs = durationMs(startedAt);
  report.metrics = {
    endToEndMs: report.totalDurationMs,
    escrowToSettlementMs: Date.now() - fundStartedAt,
  };

  console.log("\n── Summary ──");
  console.log(`  End-to-end: ${formatDuration(report.metrics.endToEndMs)}`);
  const escrowToSettlementMs = report.metrics.escrowToSettlementMs ?? 0;
  console.log(
    `  Escrow to settlement: ${formatDuration(escrowToSettlementMs)}`,
  );
  console.log(`  Final status: ${status}`);

  await writeArtifacts(report);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exit(1);
});
