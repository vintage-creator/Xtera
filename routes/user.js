const express     = require('express');
const router      = express.Router();
const User        = require('../models/User');
const requireAuth = require('../middleware/requireAuth');

// GET /api/user/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User
      .findOne({ walletAddress: req.user.address.toLowerCase() })
      .populate('person');    // person.address, person.dateOfBirth, etc.

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.person.emailVerified) {
      return res.status(403).json({ error: 'Please confirm your email first.' });
    }

    // Return the full person object (or pick the fields you need)
    const {
      firstName,
      lastName,
      email,
      mobileNumber,
      dateOfBirth,
      address
    } = user.person;

    return res.json({
      firstName,
      lastName,
      email,
      mobileNumber,
      dateOfBirth: dateOfBirth?.toISOString(),  // e.g. "1993-10-28T00:00:00.000Z"
      address,
      twoFAEnabled: !!user.twoFAEnabled
    });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// PUT /api/user/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const address = req.user.address.toLowerCase();

    const user = await User
      .findOne({ walletAddress: address })
      .populate('person');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      firstName,
      lastName,
      mobileNumber,
      address: {
        addressLine1,
        addressLine2,
        countryCode,
        city,
        state,
        postalCode
      } = {}
    } = req.body;

    const person = user.person;
    if (firstName  != null) person.firstName      = firstName;
    if (lastName   != null) person.lastName       = lastName;
    if (mobileNumber!= null)person.mobileNumber   = mobileNumber;

    if (addressLine1!= null) person.address.addressLine1 = addressLine1;
    if (addressLine2!= null) person.address.addressLine2 = addressLine2;
    if (countryCode != null) person.address.countryCode  = countryCode;
    if (city        != null) person.address.city         = city;
    if (state       != null) person.address.state        = state;
    if (postalCode  != null) person.address.postalCode   = postalCode;

    await person.save();

    return res.json({
      firstName:    person.firstName,
      lastName:     person.lastName,
      email:        person.email,          // uneditable
      mobileNumber: person.mobileNumber,
      dateOfBirth:  person.dateOfBirth,    // uneditable
      address:      person.address
    });

  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
