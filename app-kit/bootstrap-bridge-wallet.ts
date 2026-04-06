import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const requiredEnv = ["CIRCLE_API_KEY", "CIRCLE_ENTITY_SECRET"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const bootstrapAmount = process.env.APP_KIT_BRIDGE_AMOUNT ?? "1.00";
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

async function getBalances(address: `0x${string}`) {
  const [nativeBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: USDC_SEPOLIA,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);

  return {
    native: formatEther(nativeBalance),
    usdc: formatUnits(usdcBalance, 6),
  };
}

function hasEnough(balance: string, minimum: number) {
  const parsed = Number(balance);
  return Number.isFinite(parsed) && parsed >= minimum;
}

async function waitForBootstrap(address: `0x${string}`) {
  process.stdout.write("  Waiting for Sepolia faucet balances");

  for (let i = 0; i < 45; i += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 4000));
    const balances = await getBalances(address);

    if (hasEnough(balances.usdc, Number(bootstrapAmount)) && Number(balances.native) > 0) {
      console.log(
        ` ✓\n  ETH: ${balances.native}\n  USDC: ${balances.usdc}`,
      );
      return balances;
    }

    process.stdout.write(".");
  }

  throw new Error("Sepolia faucet balances did not arrive in time");
}

async function main() {
  const startedAt = new Date().toISOString();
  const privateKey = process.env.APP_KIT_PRIVATE_KEY?.startsWith("0x")
    ? (process.env.APP_KIT_PRIVATE_KEY as `0x${string}`)
    : generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  console.log("── Bootstrap App Kit bridge wallet ──");
  console.log(`Generated address: ${account.address}`);
  console.log(`Requested amount:  ${bootstrapAmount} USDC on Ethereum Sepolia`);
  const runDir = resolve(
    process.cwd(),
    ".context",
    "runs",
    `app-kit-bridge-bootstrap-${startedAt.replaceAll(":", "-")}`,
  );

  await mkdir(runDir, { recursive: true });

  let balances:
    | {
        native: string;
        usdc: string;
      }
    | undefined;

  try {
    await circleClient.requestTestnetTokens({
      address: account.address,
      blockchain: "ETH-SEPOLIA",
      native: true,
      usdc: true,
    });

    balances = await waitForBootstrap(account.address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\nAutomatic Sepolia faucet request failed: ${message}`);
    console.log("Fund the generated address manually, then use the saved wallet.env.");
  }

  const envSnippet = [
    `APP_KIT_PRIVATE_KEY=${privateKey}`,
    `APP_KIT_BRIDGE_AMOUNT=0.10`,
    `APP_KIT_BRIDGE_FROM_CHAIN=Ethereum_Sepolia`,
    `APP_KIT_BRIDGE_TO_CHAIN=Arc_Testnet`,
    `APP_KIT_BRIDGE_USE_FORWARDER=true`,
    `APP_KIT_BRIDGE_RECIPIENT_ADDRESS=${process.env.APP_KIT_BRIDGE_RECIPIENT_ADDRESS ?? ""}`,
  ].join("\n");

  await writeFile(resolve(runDir, "wallet.env"), `${envSnippet}\n`, "utf8");
  await writeFile(
    resolve(runDir, "wallet.json"),
    `${JSON.stringify(
      {
        createdAt: startedAt,
        address: account.address,
        privateKey,
        bootstrapAmount,
        balances,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\nSaved wallet env: ${resolve(runDir, "wallet.env")}`);
  console.log("Use those values with `npm run appkit:bridge:arc`.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nError: ${message}`);
  process.exit(1);
});
