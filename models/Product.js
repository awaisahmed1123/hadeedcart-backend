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
    priceRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
    },
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
        validate: {
            validator: function(v) {
                if (this.productType === 'Variable') {
                    if (!Array.isArray(v) || v.length === 0) return false;
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
    // Khali SKU ko 'undefined' set karega
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

    // Price Range Calculate Karna
    if (this.isModified('price') || this.isModified('salePrice') || this.isModified('variations')) {
        if (this.productType === 'Simple') {
            const price = this.salePrice || this.price;
            this.priceRange = { min: price, max: price };
        } else if (this.productType === 'Variable' && this.variations && this.variations.length > 0) {
            let minPrice = Infinity;
            let maxPrice = 0;
            this.variations.forEach(v => {
                const currentPrice = v.salePrice || v.price;
                if (currentPrice < minPrice) minPrice = currentPrice;
                if (currentPrice > maxPrice) maxPrice = currentPrice;
            });
            this.priceRange = { min: minPrice, max: maxPrice };
        } else {
            this.priceRange = { min: 0, max: 0 };
        }
    }
    
    next();
});

module.exports = mongoose.model('Product', ProductSchema);