// models/SwapOrder.js
const mongoose = require('mongoose');

const swapOrderSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, lowercase: true, index: true },
  txHash:        { type: String, required: true, unique: true },
  fromToken:     { type: String, required: true },
  toToken:       { type: String, required: true },
  fromAmount:    { type: Number, required: true },
  toAmount:      { type: Number, required: true },
  status:        { type: String, default: 'PENDING' },  
  createdAt:     { type: Date,   default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('SwapOrder', swapOrderSchema);
