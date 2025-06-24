const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
    },
    otpSecret: { type: String },
    twoFAEnabled: { type: Boolean, default: false },
    nonce: {
      type: String,
      default: null,
    },
    nonceExpiresAt: {
      type: Date,
      default: null,
    },
    chain: { type: String, enum: ["ETH", "SOL", "DUMMY"], required: true },
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
    },
  },
  { timestamps: true }
);

// one document per person+chain
userSchema.index({ person: 1, chain: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
