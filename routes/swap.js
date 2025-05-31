// routes/swap.js
const express     = require('express');
const router      = express.Router();
const requireAuth = require('../middleware/requireAuth');
const SwapOrder   = require('../models/swapOrder');
const { ethers }  = require('ethers');

// POST /api/swap  (record a new swap)
router.post('/', requireAuth, async (req, res) => {
  const { txHash, fromToken, toToken, fromAmount, toAmount } = req.body;
  const walletAddress = req.user.address.toLowerCase();

  try {
    // record it
    await SwapOrder.create({
      walletAddress,
      txHash,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      status: 'PENDING'
    });

    res.status(201).json({ message: 'Swap recorded' });
  } catch (err) {
    console.error('Error recording swap:', err);
    res.status(500).json({ error: 'Could not record swap' });
  }
});

// GET /api/swap   (fetch all swaps for the current user)
router.get('/', requireAuth, async (req, res) => {
  const walletAddress = req.user.address.toLowerCase();
  try {
    // find & sort newest first
    const swaps = await SwapOrder
      .find({ walletAddress })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json(swaps);
  } catch (err) {
    console.error('Error fetching swaps:', err);
    return res.status(500).json({ error: 'Could not fetch swaps' });
  }
});

module.exports = router;
