const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product.js');
const Brand = require('../models/Brand.js');
const Category = require('../models/Category.js');
const upload = require('../middleware/multer.js');
const cloudinary = require('../config/cloudinary');

// Helper function to upload images to Cloudinary
const uploadToCloudinary = async (file) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    let dataURI = "data:" + file.mimetype + ";base64," + b64;
    const result = await cloudinary.uploader.upload(dataURI, { folder: "hadeedcart_products" });
    return { public_id: result.public_id, url: result.secure_url };
};

// GET all products
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { search, category, vendor, status, inStock } = req.query;
        let query = {};
        if (search) query.$text = { $search: search };
        if (category) query.category = category;
        if (vendor) query.vendorId = vendor;
        if (status) query.status = status;
        if (inStock) query.inStock = inStock === 'true';
        
        const products = await Product.find(query).populate('brand', 'name').populate('vendorId', 'shopName').populate('category', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
        const totalProducts = await Product.countDocuments(query);
        res.json({ products, totalPages: Math.ceil(totalProducts / limit), currentPage: page });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET single product
router.get('/:id', async (req, res) => {
     try {
        const product = await Product.findById(req.params.id).populate('brand', 'name').populate('vendorId', 'shopName').populate('category'); 
        if (!product) { return res.status(404).json({ msg: 'Product nahi mila' }); }
        
        const getCategoryPath = async (categoryId) => {
            let path = [];
            let currentCategory = await Category.findById(categoryId);
            while (currentCategory) {
                path.unshift(currentCategory);
                if (currentCategory.parent) { 
                    currentCategory = await Category.findById(currentCategory.parent); 
                } else { 
                    currentCategory = null; 
                }
            }
            return path;
        };
        
        const categoryPath = await getCategoryPath(product.category._id);
        const productObject = product.toObject();
        productObject.categoryPath = categoryPath;
        res.json(productObject);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Validation rules for creating and updating products
const productValidationRules = [
    body('name', 'Naam zaroori hai').not().isEmpty(),
    body('vendorId', 'Vendor zaroori hai').not().isEmpty(),
    body('category', 'Category zaroori hai').not().isEmpty(),
    body('brand', 'Brand zaroori hai').not().isEmpty(),
];

// POST a new product
router.post('/', upload.any(), productValidationRules, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, description, price, salePrice, category, brand, inStock, vendorId, sku, status, tags } = req.body;
        
        let parsedVariations = req.body.variations ? JSON.parse(req.body.variations) : [];
        let mainImages = [];
        const variationImageFiles = {};

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                if (file.fieldname === 'images') {
                    const result = await uploadToCloudinary(file);
                    mainImages.push(result);
                } else if (file.fieldname.startsWith('variation_image_')) {
                    const index = file.fieldname.split('_')[2];
                    variationImageFiles[index] = file;
                }
            }
        }

        for (let i = 0; i < parsedVariations.length; i++) {
            if (variationImageFiles[i]) {
                const result = await uploadToCloudinary(variationImageFiles[i]);
                parsedVariations[i].image = result;
            }
        }
        
        const productData = {
            name, description, category, inStock, sku, status,
            brand: brand && mongoose.Types.ObjectId.isValid(brand) ? brand : null,
            vendorId,
            variations: parsedVariations,
            tags: tags ? JSON.parse(tags) : [],
            images: mainImages,
        };

        if (price) productData.price = price;
        if (salePrice) productData.salePrice = salePrice;

        const newProduct = new Product(productData);
        const product = await newProduct.save();
        res.status(201).json(product);
    } catch (err) {
        console.error("Product save karte waqt error:", err.message);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// PUT (Update) a product
router.put('/:id', upload.any(), productValidationRules, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ msg: 'Product nahi mila' });

        const { name, description, price, salePrice, category, brand, inStock, vendorId, sku, status, tags, variations, imagesToDelete } = req.body;

        if (imagesToDelete) {
            const publicIdsToDelete = JSON.parse(imagesToDelete);
            if (publicIdsToDelete.length > 0) {
                await cloudinary.api.delete_resources(publicIdsToDelete);
                product.images = product.images.filter(img => !publicIdsToDelete.includes(img.public_id));
            }
        }
        
        let parsedVariations = variations ? JSON.parse(variations) : product.variations;
        const variationImageFiles = {};

        if (req.files && req.files.length > 0) {
           for (const file of req.files) {
               if(file.fieldname === 'images'){
                   const result = await uploadToCloudinary(file);
                   product.images.push(result);
               } else if (file.fieldname.startsWith('variation_image_')) {
                   const index = file.fieldname.split('_')[2];
                   variationImageFiles[index] = file;
               }
           }
        }
        
        for (let i = 0; i < parsedVariations.length; i++) {
            if (variationImageFiles[i]) {
                if (parsedVariations[i].image && parsedVariations[i].image.public_id) {
                    await cloudinary.uploader.destroy(parsedVariations[i].image.public_id);
                }
                const result = await uploadToCloudinary(variationImageFiles[i]);
                parsedVariations[i].image = result;
            }
        }
        
        product.name = name;
        product.description = description;
        product.category = category;
        product.brand = brand && mongoose.Types.ObjectId.isValid(brand) ? brand : null;
        product.inStock = inStock;
        product.vendorId = vendorId;
        product.sku = sku;
        product.status = status;
        product.tags = tags ? JSON.parse(tags) : [];
        product.variations = parsedVariations;
        product.price = price ? price : undefined;
        product.salePrice = salePrice ? salePrice : undefined;
        
        await product.save();
        res.json(product);

    } catch (err) {
        console.error("Product update karte waqt error:", err.message);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// DELETE a product
router.delete('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ msg: 'Product nahi mila' });
        }

        if (product.images && product.images.length > 0) {
            const publicIds = product.images.map(img => img.public_id).filter(id => id);
            if (publicIds.length > 0) {
                await cloudinary.api.delete_resources(publicIds);
            }
        }
        
        if (product.variations && product.variations.length > 0) {
            const variationImagePublicIds = product.variations
                .map(v => v.image && v.image.public_id)
                .filter(id => id);
            if (variationImagePublicIds.length > 0) {
                await cloudinary.api.delete_resources(variationImagePublicIds);
            }
        }

        // --- YAHAN GHALTI THEEK KARDI HAI ---
        await product.deleteOne();

        res.json({ msg: 'Product delete ho gaya' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// PATCH a product for Quick Edit
router.patch('/quick-edit/:id', upload.single('image'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ msg: 'Product nahi mila' });
        }

        const { price, inStock } = req.body;

        // Price aur inStock status update karein
        if (price) {
            product.price = price;
        }
        if (inStock !== undefined) {
            // FormData se 'true' ya 'false' string mein aata hai, usko boolean mein convert karein
            product.inStock = (inStock === 'true');
        }

        // Agar nayi image upload hui hai to usko handle karein
        if (req.file) {
            // Agar pehle se koi image mojood hai, to usko Cloudinary se delete karein
            if (product.images && product.images.length > 0 && product.images[0].public_id) {
                await cloudinary.uploader.destroy(product.images[0].public_id);
            }

            // Nayi image ko Cloudinary par upload karein
            const result = await uploadToCloudinary(req.file);

            // Product ki pehli image ko nayi image se replace kar dein
            if (product.images && product.images.length > 0) {
                product.images[0] = result;
            } else {
                product.images = [result];
            }
        }
        
        await product.save();
        res.json({ msg: 'Product kamyabi se update ho gaya', product });

    } catch (err) {
        console.error("Quick Edit mein error:", err.message);
        res.status(500).send('Server Error');
    }
});
module.exports = router;