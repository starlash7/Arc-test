import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { AppKit, type BridgeParams } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { privateKeyToAccount } from "viem/accounts";

type AppKitBridgeReport = {
  startedAt: string;
  completedAt?: string;
  params: {
    fromAddress: string;
    toAddress: string;
    amount: string;
    fromChain: string;
    toChain: string;
  };
  estimate?: unknown;
  result?: unknown;
};

const requiredEnv = ["APP_KIT_PRIVATE_KEY"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const amount = process.env.APP_KIT_BRIDGE_AMOUNT ?? "0.10";
const fromChain = (process.env.APP_KIT_BRIDGE_FROM_CHAIN ??
  "Ethereum_Sepolia") as "Ethereum_Sepolia" | "Arc_Testnet";
const toChain = (process.env.APP_KIT_BRIDGE_TO_CHAIN ??
  "Arc_Testnet") as "Ethereum_Sepolia" | "Arc_Testnet";
const useForwarder =
  (process.env.APP_KIT_BRIDGE_USE_FORWARDER ?? "false").toLowerCase() === "true";
const account = privateKeyToAccount(
  process.env.APP_KIT_PRIVATE_KEY! as `0x${string}`,
);
const recipientAddress =
  process.env.APP_KIT_BRIDGE_RECIPIENT_ADDRESS?.trim() || account.address;

const kit = new AppKit();
const adapter = createViemAdapterFromPrivateKey({
  privateKey: process.env.APP_KIT_PRIVATE_KEY!,
});

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

async function writeArtifacts(report: AppKitBridgeReport) {
  const timestamp = report.startedAt.replaceAll(":", "-");
  const runDir = resolve(
    process.cwd(),
    ".context",
    "runs",
    `app-kit-bridge-${timestamp}`,
  );

  await mkdir(runDir, { recursive: true });
  await writeFile(resolve(runDir, "report.json"), `${stringifyWithBigInt(report)}\n`);

  const summary = [
    "# App Kit Bridge Run",
    "",
    `- Started: ${report.startedAt}`,
    `- Completed: ${report.completedAt ?? ""}`,
    `- From chain: ${report.params.fromChain}`,
    `- To chain: ${report.params.toChain}`,
    `- Amount: ${report.params.amount} USDC`,
    `- From: ${report.params.fromAddress}`,
    `- To: ${report.params.toAddress}`,
  ].join("\n");

  await writeFile(resolve(runDir, "summary.md"), `${summary}\n`);
  console.log(`\nArtifacts written to: ${runDir}`);
}

async function main() {
  const report: AppKitBridgeReport = {
    startedAt: new Date().toISOString(),
    params: {
      fromAddress: account.address,
      toAddress: recipientAddress,
      amount,
      fromChain,
      toChain,
    },
  };

  const bridgeParams: BridgeParams = {
    from: {
      adapter,
      chain: fromChain,
    },
    to: useForwarder
      ? {
          chain: toChain,
          recipientAddress,
          useForwarder: true,
        }
      : {
          adapter,
          chain: toChain,
          recipientAddress,
        },
    amount,
  };

  console.log(`── App Kit bridge() ${fromChain} -> ${toChain} ──`);
  console.log(`From:   ${report.params.fromAddress}`);
  console.log(`To:     ${report.params.toAddress}`);
  console.log(`Amount: ${amount} USDC`);
  console.log(`Forwarder: ${useForwarder ? "enabled" : "disabled"}`);

  const estimate = await kit.estimateBridge(bridgeParams);
  report.estimate = estimate;

  console.log("\nEstimate:");
  console.log(inspect(estimate, false, null, true));

  const result = await kit.bridge(bridgeParams);
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
