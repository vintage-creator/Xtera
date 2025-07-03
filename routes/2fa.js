const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const crypto = require("crypto");
const { verifyMessage } = require("ethers");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const Person = require("../models/Person");
const { sendVerificationEmail, sendExpiredVerificationEmail } = require("../config/emailTemplate");
const requireAuth = require("../middleware/requireAuth");

const JWT_SECRET = process.env.JWT_SECRET;

function makeLabel(addr) {
  return `${addr.slice(0, 6)}-${addr.slice(-4)}`;
}

function tryDecodeToken(req) {
  const auth = req.headers.authorization?.split(" ");
  if (auth?.[0] !== "Bearer" || !auth[1]) return null;
  try {
    return jwt.verify(auth[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// 1) GET /api/nonce/:address
router.get("/nonce/:address", async (req, res) => {
  const address = req.params.address.toLowerCase();
  const chain = address.startsWith("0x") ? "ETH" : "SOL";
  const personId = req.query.personId;

  // 1) If personId is provided ➞ you’re doing a link/re-link
  if (personId) {
    const person = await Person.findById(personId);
    if (!person) {
      return res.status(404).json({ error: "Sign up first" });
    }
    if (!person.emailVerified) {
      return res.status(403).json({ error: "Please verify your e-mail first" });
    }
    // Prevent stealing:
    const conflict = await User.findOne({ walletAddress: address, chain });
    if (conflict && conflict.person.toString() !== personId) {
      return res.status(409).json({ error: "That wallet is already taken" });
    }

    // Find your dummy or existing chain link:
    let user =
      (await User.findOne({ person: personId, chain })) ||
      (await User.findOne({ person: personId, chain: "DUMMY" }));

    if (!user) {
      user = await User.create({
        person: personId,
        walletAddress: address,
        chain,
      });
    } else {
      user.walletAddress = address;
      user.chain = chain;
    }
    const raw = crypto.randomBytes(16).toString("hex");
    user.nonce = `🔐 My App Login Nonce: ${raw}`;
    user.nonceExpiresAt = Date.now() + 5 * 60 * 1000;
    await user.save();
    return res.json({ message: user.nonce });
  }

  // 2) Otherwise, **no personId** ➞ you’re doing a **login** with an already-linked wallet
  // Find the exact wallet+chain:
  const user = await User.findOne({ walletAddress: address, chain });
  if (!user) {
    return res
      .status(404)
      .json({ error: "Wallet not linked—please sign up or link first." });
  }
  // Generate & return nonce:
  const raw = crypto.randomBytes(16).toString("hex");
  user.nonce = `🔐 My App Login Nonce: ${raw}`;
  user.nonceExpiresAt = Date.now() + 5 * 60 * 1000;
  await user.save();
  return res.json({ message: user.nonce });
});

// 2) POST /api/login
router.post("/login", async (req, res) => {
  try {
    let { address: rawAddress, signature, chain, personId } = req.body;
    if (!rawAddress || !signature || !chain) {
      return res
        .status(400)
        .json({ error: "Missing address, signature, or chain" });
    }

    // Normalize address
    const address = chain === "SOL" ? rawAddress : rawAddress.toLowerCase();

    // 1) Try finding the existing record by wallet+chain
    let user = await User.findOne({ walletAddress: address, chain });

    // 2) If none found but we have a personId, upsert that person's record for this chain
    if (!user && personId) {
      // Prevent linking someone else's wallet
      const conflict = await User.findOne({ walletAddress: address, chain });
      if (conflict) {
        return res
          .status(409)
          .json({ error: "That wallet is already linked to another account." });
      }

      user = await User.findOneAndUpdate(
        { person: personId, chain: "DUMMY" },
        { walletAddress: address, person: personId, chain },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Step 3: Fail if still no user
    if (!user) {
      return res.status(400).json({ error: "Please request a nonce first." });
    }

    // Step 4: Validate nonce & signature
    if (!user.nonce || !user.nonceExpiresAt) {
      return res
        .status(400)
        .json({ error: "Nonce not found. Mint one first." });
    }
    if (Date.now() > user.nonceExpiresAt) {
      return res.status(400).json({ error: "Nonce expired—retry login." });
    }

    if (req.body.chain === "SOL") {
      const { PublicKey } = require("@solana/web3.js");
      const nacl = require("tweetnacl");

      const msgBytes = Buffer.from(user.nonce, "utf8");
      const sigBytes = Buffer.from(signature, "base64");
      const pubkeyBytes = new PublicKey(address).toBytes();

      const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
      if (!valid) {
        return res.status(401).json({ error: "Signature mismatch" });
      }
    } else {
      const signer = verifyMessage(user.nonce, signature);
      if (signer.toLowerCase() !== address) {
        return res.status(401).json({ error: "Signature mismatch" });
      }
    }

    // Step 5: Clear nonce
    user.nonce = null;
    user.nonceExpiresAt = null;

    // Step 6: Save user (whether newly assigned walletAddress or not)
    user = await user.save();

    // Step 7: Fetch user with person details
    const fullUser = await User.findById(user._id).populate("person");

    if (!fullUser.person) {
      return res
        .status(403)
        .json({ error: "Wallet not registered—please sign up first." });
    }

    if (!fullUser.person.emailVerified) {
      return res
        .status(403)
        .json({ error: "Email not verified. Check your inbox." });
    }

    // Step 8: Issue JWT
    const token = jwt.sign(
      { address, personId: fullUser.person._id.toString() },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const firstTimeLink = Boolean(personId);
    const message = firstTimeLink
      ? "✅ Wallet linked—welcome aboard!"
      : "👋 Found your account—logging you in.";

    return res.json({
      token,
      firstName: fullUser.person.firstName,
      message,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/2fa/setup  (protected)
router.post("/2fa/setup", requireAuth, async (req, res) => {
  try {
    const addr = req.user.address.toLowerCase();
    let user =
      (await User.findOne({ walletAddress: addr })) ||
      new User({ walletAddress: addr });

    const label = user.otpLabel || makeLabel(addr);

    let otpauthUrl;
    if (!user.otpSecret) {
      // FIRST TIME: generate & persist both secret & label
      const secret = speakeasy.generateSecret({
        name: label,
        issuer: "Xtera",
        algorithm: "sha1",
        digits: 6,
        period: 30,
      });
      user.otpSecret = secret.base32;
      user.otpLabel = label;
      await user.save();

      otpauthUrl = secret.otpauth_url;
    } else {
      // REUSE existing secret & label
      otpauthUrl = speakeasy.otpauthURL({
        secret: user.otpSecret,
        label,
        issuer: "Xtera",
        algorithm: "sha1",
        digits: 6,
        period: 30,
      });
    }

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return res.json({ qr: qrDataUrl, secret: user.otpSecret });
  } catch (err) {
    console.error("Error in /2fa/setup:", err);
    return res.status(500).json({ error: "Failed to generate 2FA QR code" });
  }
});

// POST /api/2fa/verify  (protected)
router.post("/2fa/verify", requireAuth, async (req, res) => {
  const { token } = req.body;
  const addr = req.user.address.toLowerCase();
  const user = await User.findOne({ walletAddress: addr });

  if (!user?.otpSecret) {
    return res.status(400).json({ error: "2FA not initiated" });
  }

  const verified = speakeasy.totp.verify({
    secret: user.otpSecret,
    encoding: "base32",
    token,
    window: 1,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });

  if (!verified) {
    return res.status(401).json({ error: "Invalid 2FA code" });
  }

  user.twoFAEnabled = true;
  await user.save();
  res.json({ success: true });
});

router.post("/register", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      firstName,
      lastName,
      email,
      mobileNumber,
      dateOfBirth,
      addressLine1,
      addressLine2,
      countryCode,
      city,
      state,
      postalCode,
    } = req.body;

    // Check if user already exists
    const existingUser = await Person.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        message: "Email already in use, please sign in!",
      });
    }

    const person = await Person.create(
      [
        {
          firstName,
          lastName,
          email,
          mobileNumber,
          dateOfBirth,
          address: {
            addressLine1,
            addressLine2,
            countryCode,
            city,
            state,
            postalCode,
          },
          verificationToken: crypto.randomBytes(32).toString("hex"),
          verificationExpires: Date.now() + 24 * 60 * 60 * 1000,
        },
      ],
      { session }
    );

    const personDoc = person[0];

    const existingPerson = await User.findOne({
      person: personDoc._id,
    }).session(session);
    if (existingPerson) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "User already exists for this person. Please sign in.",
      });
    }

    await User.create(
      [
        {
          person: personDoc._id,
          walletAddress: `xtera-${crypto.randomBytes(8).toString("hex")}`,
          chain: "DUMMY",
        },
      ],
      { session }
    );

    const protocol = req.protocol;
    const host = req.get("host");
    const confirmUrl = `${protocol}://${host}/api/confirm-email?token=${personDoc.verificationToken}&id=${personDoc._id}`;

    await sendVerificationEmail(personDoc.email, personDoc.firstName, confirmUrl);
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Registered! Check your inbox to confirm your email.",
      personId: personDoc._id,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error.code === 11000 && error.keyPattern?.walletAddress) {
      return res.status(409).json({
        message:
          "A user with your wallet address already exists. Please sign in.",
      });
    }
    console.error("Registration Error:", error);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

router.get("/confirm-email", async (req, res) => {
  const { token, id } = req.query;

  if (!token || !id) {
    return res.status(400).send("Missing token or user ID.");
  }

  try {
    const person = await Person.findById(id);
    if (!person) {
      return res.status(404).send("User not found.");
    }

    if (person.emailVerified) {
      return res.redirect("/email-already-verified.html");
    }
    if (
      person.verificationToken !== token ||
      person.verificationExpires < Date.now()
    ) {
      return res.redirect(`/token-expired.html?Id=${id}`);
    }

    person.emailVerified        = true;
    person.verificationToken    = undefined;
    person.verificationExpires  = undefined;
    await person.save();

    return res.redirect("/email-confirmed.html");
  } catch (err) {
    console.error("Error in /confirm-email:", err);
    return res
      .status(500)
      .json({ message: "An error occurred while confirming your email." });
  }
});


router.get('/resend-verification', async (req, res) => {
  const { Id } = req.query;

  if (!Id) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  try {
    const user = await Person.findById(Id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    user.verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const protocol = req.protocol;
    const host = req.get('host');
    const confirmUrl = `${protocol}://${host}/api/confirm-email?token=${user.verificationToken}&id=${user._id}`;
    
    await sendExpiredVerificationEmail(user.email, user.firstName, confirmUrl)

    res.redirect(`/verification-resent.html?email=${encodeURIComponent(user.email)}&id=${user._id}`);

  } catch (error) {
    console.error("Resend error:", error);
    res.status(500).json({ error: "Error resending verification" });
  }
});


router.get("/status", async (req, res) => {
  let address;

  // 1) Try to decode a JWT. If present & valid, use its address:
  const payload = tryDecodeToken(req);
  if (payload?.address) {
    address = payload.address.toLowerCase();
  } else {
    // 2) No valid token → fall back to query param
    address = (req.query.address || "").toLowerCase();
    if (!address) {
      return res
        .status(400)
        .json({ registered: false, message: "No address provided" });
    }
  }

  // 3) Lookup the User + Person by address
  const user = await User.findOne({ walletAddress: address }).populate(
    "person"
  );
  if (!user || !user.person) {
    return res.status(200).json({ registered: false });
  }
  if (!user.person.emailVerified) {
    return res
      .status(200)
      .json({ registered: false, message: "Email not verified" });
  }

  // 4) They’re fully registered & email-verified
  return res
    .status(200)
    .json({ registered: true, firstName: user.person.firstName });
});

module.exports = router;
