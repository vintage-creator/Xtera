// models/Person.js
const mongoose = require('mongoose');

const personSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  emailVerified:      { type: Boolean, default: false },
  verificationToken:  { type: String },
  verificationExpires:{ type: Date },
  address: {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    countryCode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('Person', personSchema);
