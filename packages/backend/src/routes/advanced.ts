import { Hono } from "hono";
import { getReadOnlyWallet } from "../services/starkzap.js";
import { type DbUser } from "../services/db.js";
import { log } from "../utils/logger.js";

const advanced = new Hono();

advanced.get("/deploy-status", async (c) => {
  const user = c.get("user") as DbUser;
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    const deployed = await wallet.isDeployed();
    return c.json({ deployed, address: wallet.address });
  } catch (err: any) {
    return c.json({ error: "deploy_check_error", message: err.message }, 500);
  }
});

advanced.post("/deploy", async (c) => {
  const user = c.get("user") as DbUser;
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    const deployed = await wallet.isDeployed();
    if (deployed) return c.json({ deployed: true, message: "Already deployed" });

    await wallet.ensureReady({ deploy: "if_needed" as any });
    return c.json({ deployed: true, message: "Account deployed" });
  } catch (err: any) {
    log.error("deploy", err.message);
    return c.json({ error: "deploy_error", message: err.message }, 500);
  }
});

advanced.post("/sign-message", async (c) => {
  const user = c.get("user") as DbUser;
  const { typedData } = await c.req.json();
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    const signature = await wallet.signMessage(typedData);
    return c.json({ signature: Array.isArray(signature) ? signature.map(String) : [String(signature)] });
  } catch (err: any) {
    return c.json({ error: "sign_error", message: err.message }, 500);
  }
});

export default advanced;
