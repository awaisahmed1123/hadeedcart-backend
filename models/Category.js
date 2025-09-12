const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category ka naam zaroori hai.'],
    unique: true,
    trim: true,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true,
  },
  image: {
    public_id: {
      type: String,
    },
    secure_url: {
      type: String,
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);