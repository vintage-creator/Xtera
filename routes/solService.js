const { Connection, PublicKey } = require("@solana/web3.js");
const express = require("express");
const router = express.Router();

const SOLANA_RPC = process.env.SOLANA_RPC_URL; 

const solanaConn = new Connection(SOLANA_RPC, "confirmed");

// GET /api/solana/balance/:address
router.get("/solana/balance/:address", async (req, res) => {
  try {
    const pubkey = new PublicKey(req.params.address);
    const lamports = await solanaConn.getBalance(pubkey);
    return res.json({ balance: lamports / 1e9 });
  } catch (err) {
    console.error("Solana balance error:", err);
    return res.status(502).json({ error: "Failed to fetch balance" });
  }
});

module.exports = router;
