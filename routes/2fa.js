const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const crypto = require("crypto");
const mailer = require("../config/mailer");
const { verifyMessage } = require("ethers");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const Person = require("../models/Person");
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
  const user =
    (await User.findOne({ walletAddress: address })) ||
    new User({ walletAddress: address });

  // wrap the raw randomness in a clear‐text label
  const raw = crypto.randomBytes(16).toString("hex");
  const message = `🔐 My App Login Nonce: ${raw}`;
  user.nonce = message;
  user.nonceExpiresAt = Date.now() + 5 * 60 * 1000;
  await user.save();

  res.json({ message });
});

// 2) POST /api/login
router.post("/login", async (req, res) => {
  try {
    let { address: rawAddress, signature, chain, personId } = req.body;
    if (!rawAddress || !signature) {
      return res.status(400).json({ error: "Missing address or signature" });
    }
    const address = chain === "SOL" ? rawAddress : rawAddress.toLowerCase();

    // 1) Find the one User document that MUST exist (because /api/nonce/:address ran first)
    let user = await User.findOne({ walletAddress: address });

    if (!user && personId) {
      // This is the first time this wallet is seen for that person
      user = await User.create({ walletAddress: address, person: personId });
    }

    // If no user found, it means /api/nonce/:address was not called, so bail:
    if (!user) {
      return res.status(400).json({ error: "Please request a nonce first." });
    }

    // 2) Validate that nonce & signature match
    if (!user.nonce || !user.nonceExpiresAt) {
      return res
        .status(400)
        .json({ error: "Nonce not found. Mint one first." });
    }
    if (Date.now() > user.nonceExpiresAt) {
      return res.status(400).json({ error: "Nonce expired—retry login." });
    }

    if (req.body.chain === "SOL") {
      // Solana login: Ed25519 verify
      const { PublicKey } = require("@solana/web3.js");
      const nacl = require("tweetnacl");

      // message is your nonce string, signature is base64
      const msgBytes = Buffer.from(user.nonce, "utf8");
      const sigBytes = Buffer.from(signature, "base64");
      const pubkeyBytes = new PublicKey(address).toBytes();

      const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
      if (!valid) {
        return res.status(401).json({ error: "Signature mismatch" });
      }
    } else {
      // Ethereum login: ECDSA verify
      const signer = verifyMessage(user.nonce, signature);
      if (signer.toLowerCase() !== address) {
        return res.status(401).json({ error: "Signature mismatch" });
      }
    }
    // 3) Clear the nonce fields so they can’t be reused
    user.nonce = null;
    user.nonceExpiresAt = null;

    // 4) If this is the first time linking a Person, attach it now
    if (!user.person && personId) {
      user.person = personId;
    }

    // 5) SAVE the same User document you fetched in step 1:
    user = await user.save();

    // 6) Populate the Person so we can check emailVerified & grab firstName
    const fullUser = await User.findById(user._id).populate("person");

    // 7) If still no Person linked, that means wallet is unregistered
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

    // 8) Now issue a JWT
    const token = jwt.sign({ address, personId: fullUser.person._id.toString() }, JWT_SECRET, { expiresIn: "1h" });

    // 9) Decide whether this was first‐time link or just login
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
    return res.json({ qr: qrDataUrl });
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
        },
      ],
      { session }
    );

    const protocol = req.protocol;
    const host = req.get("host");
    const confirmUrl = `${protocol}://${host}/api/confirm-email?token=${personDoc.verificationToken}`;

    const emailHtml = `
    <div
      style="
        max-width:600px;
        margin:0 auto;
        font-family:Arial,sans-serif;
        color:#333;
        border:1px solid #e0e0e0;
        border-radius:8px;
        padding:2rem;
        box-shadow:0 2px 8px rgba(0,0,0,0.05);
      "
    >
      <div style="text-align:center; margin-bottom:2rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
        <img
          src="https://res.cloudinary.com/dcoxo8snb/image/upload/v1747615055/logo-512_yvvclj.png"
          alt="Xtera Logo"
          width="48"
          style="display:block;"
        />
        <h1 style="margin:0; font-size:1.5rem; color:#005eff;">Xtera</h1>
      </div>

      <p style="font-size:1rem; line-height:1.5;">
        Hi <strong>${personDoc.firstName}</strong>,
      </p>

      <p style="font-size:1rem; line-height:1.5;">
        Thanks for registering with Xtera! Please click the button below to confirm your email address and complete your account setup.
      </p>

      <div style="text-align:center; margin:2rem 0;">
        <a
          href="${confirmUrl}"
          style="
            display:inline-block;
            text-decoration:none;
            background-color:#005eff;
            color:#ffffff;
            padding:0.75rem 1.5rem;
            border-radius:4px;
            font-weight:bold;
            font-size:1rem;
          "
        >
          Confirm your email
        </a>
      </div>

      <p style="font-size:0.9rem;color:#666;line-height:1.4;">
        If that button doesn’t work, copy and paste this link into your browser:<br>
        <a href="${confirmUrl}" style="color:#005eff;">${confirmUrl}</a>
      </p>

      <p style="font-size:0.8rem;color:#999;line-height:1.2;">
        This link will expire in 24 hours.
      </p>
    </div>
  `;

    await mailer.sendMail({
      to: personDoc.email,
      from: '"Xtera" <judexchange@zohomail.com>',
      subject: "Please confirm your email",
      html: emailHtml,
    });

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
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ message: "Verification token is required." });
  }

  try {
    // look up a matching user with an unexpired token
    const user = await Person.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token." });
    }

    // mark email as verified
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    // success → redirect to your frontend confirmation page:
    return res.redirect("/email-confirmed.html");
  } catch (err) {
    console.error("Error confirming email:", err);
    return res
      .status(500)
      .json({ message: "An error occurred while confirming your email." });
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
