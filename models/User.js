const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: { 
    type: String, 
    unique: true,  
    lowercase: true,
    partialFilterExpression: { walletAddress: { $type: "string", $ne: null } }
  },
  otpSecret:     { type: String },
  twoFAEnabled:  { type: Boolean, default: false },
  nonce: {
    type: String,
    default: null,
  },
  nonceExpiresAt: {
    type: Date,
    default: null,
  },
  person: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  },  
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
