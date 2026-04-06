import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { AppKit, type SwapParams } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { privateKeyToAccount } from "viem/accounts";

type AppKitSwapReport = {
  startedAt: string;
  completedAt?: string;
  params: {
    fromAddress: string;
    toAddress: string;
    amountIn: string;
    tokenIn: string;
    tokenOut: string;
    chain: string;
    slippageBps: number;
  };
  estimate?: unknown;
  result?: unknown;
};

const requiredEnv = ["APP_KIT_PRIVATE_KEY", "KIT_KEY"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const amountIn = process.env.APP_KIT_SWAP_AMOUNT_IN ?? "1.00";
const chain = process.env.APP_KIT_SWAP_CHAIN ?? "Ethereum";
const tokenIn = (process.env.APP_KIT_SWAP_TOKEN_IN ?? "USDC") as SwapParams["tokenIn"];
const tokenOut = (process.env.APP_KIT_SWAP_TOKEN_OUT ?? "USDT") as SwapParams["tokenOut"];
const slippageBps = Number.parseInt(
  process.env.APP_KIT_SWAP_SLIPPAGE_BPS ?? "300",
  10,
);

if (!Number.isFinite(slippageBps) || slippageBps <= 0) {
  throw new Error("APP_KIT_SWAP_SLIPPAGE_BPS must be a positive integer");
}

const kit = new AppKit();
const adapter = createViemAdapterFromPrivateKey({
  privateKey: process.env.APP_KIT_PRIVATE_KEY!,
});
const account = privateKeyToAccount(
  process.env.APP_KIT_PRIVATE_KEY! as `0x${string}`,
);
const recipientAddress = account.address;

function stringifyWithBigInt(value: unknown) {
  return JSON.stringify(
    value,
    (_, currentValue) =>
      typeof currentValue === "bigint"
        ? `${currentValue.toString()}n`
        : currentValue,
    2,
  );
}

async function writeArtifacts(report: AppKitSwapReport) {
  const timestamp = report.startedAt.replaceAll(":", "-");
  const runDir = resolve(
    process.cwd(),
    ".context",
    "runs",
    `app-kit-swap-${timestamp}`,
  );

  await mkdir(runDir, { recursive: true });
  await writeFile(resolve(runDir, "report.json"), `${stringifyWithBigInt(report)}\n`);

  const summary = [
    "# App Kit Swap Run",
    "",
    `- Started: ${report.startedAt}`,
    `- Completed: ${report.completedAt ?? ""}`,
    `- Chain: ${report.params.chain}`,
    `- Token in: ${report.params.tokenIn}`,
    `- Token out: ${report.params.tokenOut}`,
    `- Amount in: ${report.params.amountIn}`,
    `- Slippage bps: ${report.params.slippageBps}`,
    `- From: ${report.params.fromAddress}`,
    `- To: ${report.params.toAddress}`,
  ].join("\n");

  await writeFile(resolve(runDir, "summary.md"), `${summary}\n`);
  console.log(`\nArtifacts written to: ${runDir}`);
}

function assertSwapChainSupported(selectedChain: string) {
  const supportedChains = kit.getSupportedChains("swap");
  const supportedChainNames = new Set<string>(
    supportedChains.map((supportedChain) => supportedChain.chain),
  );

  if (!supportedChainNames.has(selectedChain)) {
    const supported = supportedChains.map((supportedChain) => supportedChain.chain).join(", ");
    throw new Error(
      `App Kit swap is not supported on ${selectedChain}. Current swap-capable chains: ${supported}`,
    );
  }
}

async function main() {
  assertSwapChainSupported(chain);

  const report: AppKitSwapReport = {
    startedAt: new Date().toISOString(),
    params: {
      fromAddress: account.address,
      toAddress: recipientAddress,
      amountIn,
      tokenIn,
      tokenOut,
      chain,
      slippageBps,
    },
  };

  const swapParams: SwapParams = {
    from: {
      adapter,
      chain: chain as SwapParams["from"]["chain"],
    },
    tokenIn,
    tokenOut,
    amountIn,
    config: {
      kitKey: process.env.KIT_KEY!,
      slippageBps,
    },
  };

  console.log(`── App Kit swap() on ${chain} ──`);
  console.log(`From:      ${report.params.fromAddress}`);
  console.log(`To:        ${report.params.toAddress}`);
  console.log(`Token in:  ${tokenIn}`);
  console.log(`Token out: ${tokenOut}`);
  console.log(`Amount in: ${amountIn}`);
  console.log(`Slippage:  ${slippageBps} bps`);

  const estimate = await kit.estimateSwap(swapParams);
  report.estimate = estimate;

  console.log("\nEstimate:");
  console.log(inspect(estimate, false, null, true));

  const result = await kit.swap(swapParams);
  report.result = result;
  report.completedAt = new Date().toISOString();

  console.log("\nResult:");
  console.log(inspect(result, false, null, true));

  await writeArtifacts(report);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exit(1);
});
