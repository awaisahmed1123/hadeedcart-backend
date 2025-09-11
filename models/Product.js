const mongoose = require('mongoose');

// Variation ki sub-schema
const VariationSchema = new mongoose.Schema({
    attribute: { type: String },
    value: { type: String },
    price: { type: Number },
    salePrice: { type: Number },
    stock: { type: Number, default: 0 },
    sku: { type: String, trim: true },
    image: {
        public_id: { type: String },
        url: { type: String }
    }
}, { _id: false });

// Asal Product ki schema
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    productType: {
        type: String,
        enum: ['Simple', 'Variable'],
        default: 'Simple',
        required: true
    },
    price: {
        type: Number,
        // Sirf 'Simple' product ke liye zaroori hai
        required: function() { return this.productType === 'Simple'; }
    },
    salePrice: {
        type: Number,
        validate: {
            validator: function(value) {
                // Sale price hamesha regular price se kam honi chahiye
                return !this.price || !value || value < this.price;
            },
            message: 'Sale price, asal price se kam honi chahiye.'
        }
    },
    sku: { type: String, unique: true, sparse: true, trim: true },
    inStock: { type: Boolean, default: true },
    images: [{
        public_id: { type: String, required: true },
        url: { type: String, required: true }
    }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    isFeatured: { type: Boolean, default: false },
    tags: [{ type: String }],
    status: {
        type: String,
        enum: ['Published', 'Draft'],
        default: 'Published'
    },
    variations: {
        type: [VariationSchema],
        // 'Variable' product ke liye kam se kam ek variation zaroori hai
        validate: {
            validator: function(v) {
                if (this.productType === 'Variable') {
                    // Check if it's an array and has at least one variation
                    if (!Array.isArray(v) || v.length === 0) return false;
                    
                    // Check if each variation has the required fields
                    for(const variation of v) {
                        if (!variation.attribute || !variation.value || variation.price == null || variation.stock == null) {
                            return false;
                        }
                    }
                }
                return true;
            },
            message: 'Variable product ke liye kam se kam ek variation zaroori hai aur har variation mein attribute, value, price, aur stock hona chahiye.'
        }
    },
}, { timestamps: true });

// Text search ke liye index
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Pre-save hook (data save hone se pehle chalta hai)
ProductSchema.pre('save', function(next) {
    // Khali SKU ko 'undefined' set karega taake sparse index theek kaam kare
    if (this.isModified('sku') && this.sku === '') {
        this.sku = undefined;
    }
    if (this.isModified('variations') && this.variations && this.variations.length > 0) {
        this.variations.forEach(variation => {
            if (variation.sku === '') {
                variation.sku = undefined;
            }
        });
    }
    next();
});

module.exports = mongoose.model('Product', ProductSchema);