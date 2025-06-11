// routes/wallet.js
const express = require("express");
const { PublicKey } = require("@solana/web3.js");
const nacl = require("tweetnacl");
const { verifyMessage } = require("ethers");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const router = express.Router();

router.post("/link", requireAuth, async (req, res) => {
  // pull the signed message out of the POST body
  const { address: raw, signature, chain, message } = req.body;
  const newAddr = chain === "SOL" ? raw : raw.toLowerCase();

  // if no message, bail
  if (typeof message !== "string") {
    return res.status(400).json({ error: "Missing signed message" });
  }

  // verify signature
  if (chain === "SOL") {
    // Solana: Ed25519 verify
    const msgBytes = Buffer.from(message, "utf8");
    const sigBytes = Buffer.from(signature, "base64");
    const valid = nacl.sign.detached.verify(
      msgBytes,
      sigBytes,
      new PublicKey(newAddr).toBytes()
    );
    if (!valid) {
      return res.status(401).json({ error: "Signature mismatch" });
    }
  } else {
    // Ethereum: ECDSA verify via ethers
    let signer;
    try {
      signer = verifyMessage(message, signature);
    } catch (e) {
      return res.status(400).json({ error: "Invalid signature format" });
    }
    if (signer.toLowerCase() !== newAddr) {
      return res.status(401).json({ error: "Signature mismatch" });
    }
  }

  const currentUser = await User.findOne({ walletAddress: req.user.address });
  if (!currentUser) {
    return res
      .status(500)
      .json({ error: "Internal error: could not find your account." });
  }

  try {
    const already = await User.findOne({ walletAddress: newAddr });
    if (already) {
      return res.json({ success: true });
    }
    await User.create({ walletAddress: newAddr, person: currentUser.person });
    return res.json({ success: true });
  } catch (e) {
    console.error("Link wallet error:", e);
    return res.status(500).json({ error: "Failed to link wallet" });
  }
});

module.exports = router;
