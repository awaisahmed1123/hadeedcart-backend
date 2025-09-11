const mongoose = require('mongoose');

const VariationSchema = new mongoose.Schema({
    attribute: { type: String, required: true },
    value: { type: String, required: true },
    price: { type: Number, required: true },
    salePrice: { type: Number },
    stock: { type: Number, default: 0, required: true },
    sku: { type: String, trim: true },
    image: {
        public_id: { type: String },
        url: { type: String }
    }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    productType: {
        type: String,
        enum: ['Simple', 'Variable'],
        default: 'Simple',
        required: true
    },
    price: { type: Number }, 
    salePrice: {
        type: Number,
        validate: {
            validator: function(value) {
                if (this.price && value) {
                    return value < this.price;
                }
                return true;
            },
            message: 'Sale price, asal price se kam honi chahiye.'
        }
    },
    sku: { type: String, unique: true, sparse: true, trim: true },
    inStock: { type: Boolean, default: true },
    images: [{
        public_id: { type: String },
        url: { type: String }
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
    weight: { type: String },
    dimensions: {
        length: { type: Number },
        width: { type: Number },
        height: { type: Number },
    },
    variations: [VariationSchema],
}, { timestamps: true });

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

// YEH ZAROORI HAI: Khali SKU ko null mein convert karega
ProductSchema.pre('save', function(next) {
    if (this.sku === '') {
        this.sku = null;
    }
    if (this.variations && this.variations.length > 0) {
        this.variations.forEach(variation => {
            if (variation.sku === '') {
                variation.sku = null;
            }
        });
    }
    next();
});

module.exports = mongoose.model('Product', ProductSchema);