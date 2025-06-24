// routes/wallet.js
const express = require("express");
const { PublicKey } = require("@solana/web3.js");
const nacl = require("tweetnacl");
const { verifyMessage } = require("ethers");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const router = express.Router();

router.post("/link", requireAuth, async (req, res) => {
  const { address: raw, signature, chain, message } = req.body;
  if (!raw || !signature || !chain || typeof message !== "string") {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const address = chain === "SOL" ? raw : raw.toLowerCase();

  // 1) Verify signature:
  try {
    if (chain === "SOL") {
      const msgBytes = Buffer.from(message, "utf8");
      const sigBytes = Buffer.from(signature, "base64");
      const valid = nacl.sign.detached.verify(
        msgBytes,
        sigBytes,
        new PublicKey(address).toBytes()
      );
      if (!valid) throw new Error("Signature mismatch");
    } else {
      const signer = verifyMessage(message, signature);
      if (signer.toLowerCase() !== address) throw new Error("Signature mismatch");
    }
  } catch (err) {
    return res.status(401).json({ error: err.message || "Invalid signature" });
  }

  // 2) Check for duplicate wallet (used by someone else)
  const exists = await User.findOne({ walletAddress: address });
  if (exists && exists.person.toString() !== req.user.person.toString()) {
    return res.status(409).json({ error: "Wallet already linked to another account" });
  }

  // 3) Proceed to link if allowed
  try {
    await User.findOneAndUpdate(
      { person: req.user.person, chain }, // filter
      { walletAddress: address, person: req.user.person, chain },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("Link wallet error:", err);
    return res.status(500).json({ error: "Failed to link wallet" });
  }
});



module.exports = router;
