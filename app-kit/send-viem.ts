import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { AppKit, type SendParams } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { privateKeyToAccount } from "viem/accounts";

type AppKitSendReport = {
  startedAt: string;
  completedAt?: string;
  params: {
    fromAddress: string;
    toAddress: string;
    amount: string;
    token: string;
    chain: string;
  };
  estimate?: unknown;
  result?: unknown;
};

const requiredEnv = ["APP_KIT_PRIVATE_KEY", "APP_KIT_RECIPIENT_ADDRESS"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const amount = process.env.APP_KIT_SEND_AMOUNT ?? "0.10";
const token = process.env.APP_KIT_SEND_TOKEN ?? "USDC";

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

async function writeArtifacts(report: AppKitSendReport) {
  const timestamp = report.startedAt.replaceAll(":", "-");
  const runDir = resolve(
    process.cwd(),
    ".context",
    "runs",
    `app-kit-send-${timestamp}`,
  );

  await mkdir(runDir, { recursive: true });
  await writeFile(resolve(runDir, "report.json"), `${stringifyWithBigInt(report)}\n`);

  const summary = [
    "# App Kit Send Run",
    "",
    `- Started: ${report.startedAt}`,
    `- Completed: ${report.completedAt ?? ""}`,
    `- Chain: ${report.params.chain}`,
    `- Token: ${report.params.token}`,
    `- Amount: ${report.params.amount}`,
    `- From: ${report.params.fromAddress}`,
    `- To: ${report.params.toAddress}`,
  ].join("\n");

  await writeFile(resolve(runDir, "summary.md"), `${summary}\n`);
  console.log(`\nArtifacts written to: ${runDir}`);
}

async function main() {
  const fromAddress = privateKeyToAccount(
    process.env.APP_KIT_PRIVATE_KEY! as `0x${string}`,
  ).address;
  const report: AppKitSendReport = {
    startedAt: new Date().toISOString(),
    params: {
      fromAddress,
      toAddress: process.env.APP_KIT_RECIPIENT_ADDRESS!,
      amount,
      token,
      chain: "Arc_Testnet",
    },
  };

  const sendParams: SendParams = {
    from: {
      adapter,
      chain: "Arc_Testnet",
    },
    to: process.env.APP_KIT_RECIPIENT_ADDRESS!,
    amount,
    token,
  };

  console.log("── App Kit send() on Arc Testnet ──");
  console.log(`From:   ${report.params.fromAddress}`);
  console.log(`To:     ${report.params.toAddress}`);
  console.log(`Amount: ${amount} ${token}`);

  const estimate = await kit.estimateSend(sendParams);
  report.estimate = estimate;

  console.log("\nEstimate:");
  console.log(inspect(estimate, false, null, true));

  const result = await kit.send(sendParams);
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
