// models/Banner.js

const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
    image: {
        public_id: { type: String, required: true },
        url: { type: String, required: true }
    },
    type: {
        type: String,
        required: true,
        enum: ['Slider', 'Middle', 'Advertisement']
    },
    link: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Banner', BannerSchema);