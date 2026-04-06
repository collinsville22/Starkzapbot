import { Hono } from "hono";
import { getTransactions, type DbUser } from "../services/db.js";

const history = new Hono();

history.get("/", async (c) => {
  const user = c.get("user") as DbUser;
  const limit = parseInt(c.req.query("limit") ?? "50");
  const type = c.req.query("type"); // optional filter

  try {
    let txs = getTransactions(user.id, Math.min(limit, 100));

    if (type) {
      txs = txs.filter((t) => t.type === type);
    }

    return c.json({
      transactions: txs.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        txHash: t.tx_hash,
        details: t.details ? JSON.parse(t.details) : null,
        createdAt: t.created_at,
      })),
    });
  } catch (err: any) {
    return c.json({ error: "history_error", message: err.message }, 500);
  }
});

export default history;
