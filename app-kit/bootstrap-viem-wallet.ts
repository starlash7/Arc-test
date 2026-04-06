import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const requiredEnv = [
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "APP_KIT_FUNDER_WALLET_ADDRESS",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const USDC_TOKEN_ADDRESS = "0x3600000000000000000000000000000000000000";
const bootstrapAmount = process.env.APP_KIT_BOOTSTRAP_AMOUNT ?? "1.00";

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

async function waitForTransaction(txId: string, label: string) {
  process.stdout.write(`  Waiting for ${label}`);

  for (let i = 0; i < 60; i += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
    const tx = await circleClient.getTransaction({ id: txId });
    const data = tx.data?.transaction;

    if (data?.state === "COMPLETE" && data.txHash) {
      console.log(
        ` ✓\n  Tx: https://testnet.arcscan.app/tx/${data.txHash}`,
      );
      return data.txHash;
    }

    if (data?.state === "FAILED") {
      throw new Error(`${label} failed onchain`);
    }

    process.stdout.write(".");
  }

  throw new Error(`${label} timed out`);
}

async function main() {
  const privateKey = process.env.APP_KIT_PRIVATE_KEY?.startsWith("0x")
    ? (process.env.APP_KIT_PRIVATE_KEY as `0x${string}`)
    : generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const startedAt = new Date().toISOString();

  console.log("── Bootstrap App Kit viem wallet ──");
  console.log(`Generated address: ${account.address}`);
  console.log(`Funding amount:    ${bootstrapAmount} USDC`);

  const tx = await circleClient.createTransaction({
    walletAddress: process.env.APP_KIT_FUNDER_WALLET_ADDRESS!,
    blockchain: "ARC-TESTNET",
    tokenAddress: USDC_TOKEN_ADDRESS,
    destinationAddress: account.address,
    amount: [bootstrapAmount],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const txHash = await waitForTransaction(tx.data?.id!, "bootstrap transfer");
  const runDir = resolve(process.cwd(), ".context", "runs", `app-kit-bootstrap-${startedAt.replaceAll(":", "-")}`);

  await mkdir(runDir, { recursive: true });

  const envSnippet = [
    `APP_KIT_PRIVATE_KEY=${privateKey}`,
    `APP_KIT_RECIPIENT_ADDRESS=${process.env.APP_KIT_FUNDER_WALLET_ADDRESS!}`,
    `APP_KIT_SEND_AMOUNT=0.10`,
    `APP_KIT_SEND_TOKEN=USDC`,
  ].join("\n");

  await writeFile(resolve(runDir, "wallet.env"), `${envSnippet}\n`, "utf8");
  await writeFile(
    resolve(runDir, "wallet.json"),
    `${JSON.stringify(
      {
        createdAt: startedAt,
        address: account.address,
        privateKey,
        funderWalletAddress: process.env.APP_KIT_FUNDER_WALLET_ADDRESS!,
        bootstrapAmount,
        txHash,
        explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nSaved wallet env: ${resolve(runDir, "wallet.env")}`);
  console.log("Use those values with `npm run appkit:send:arc`.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exit(1);
});
