const mongoose = require('mongoose');

const BrandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Brand ka naam zaroori hai.'],
    unique: true,
    trim: true // Faltu spaces ko khud hi hata dega
  },
}, { timestamps: true });

module.exports = mongoose.model('Brand', BrandSchema);