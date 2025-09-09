const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false // Security ke liye, queries mein password nahi aayega
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    // User ke multiple addresses ho sakte hain
    addresses: [{
        addressType: { type: String, enum: ['Home', 'Work'], default: 'Home' },
        street: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, default: 'Pakistan' }
    }],
    // User ke tamam orders ka reference
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);