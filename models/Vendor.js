const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  shopName: { type: String, required: true, unique: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  cnic: { type: String, trim: true, unique: true, sparse: true },
  shopLogo: {
    public_id: { type: String },
    url: { type: String }
  },
  accountStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Suspended'],
    default: 'Pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Vendor', VendorSchema);