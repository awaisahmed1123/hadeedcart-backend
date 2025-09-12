const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product.js');
const Category = require('../models/Category.js');
const upload = require('../middleware/multer.js');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth.js');
const { Parser } = require('json2csv');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Cloudinary par file upload karne ka helper function
const uploadToCloudinary = async (file) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;
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
        console.error("Products fetch karte waqt error:", err.message);
        res.status(500).send('Server Error');
    }
});

// GET a single product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('brand', 'name').populate('vendorId', 'shopName').populate('category');
        if (!product) { return res.status(404).json({ msg: 'Product nahi mila' }); }
        const getCategoryPath = async (categoryId) => {
            let path = [];
            if (!categoryId) return path;
            let currentCategory = await Category.findById(categoryId);
            let depth = 0;
            while (currentCategory && depth < 10) {
                path.unshift(currentCategory);
                currentCategory = currentCategory.parent ? await Category.findById(currentCategory.parent) : null;
                depth++;
            }
            return path;
        };
        const productObject = product.toObject();
        productObject.categoryPath = await getCategoryPath(product.category?._id);
        res.json(productObject);
    } catch (err) {
        console.error("Single Product fetch karte waqt error:", err.message);
        res.status(500).send('Server Error');
    }
});

const productValidationRules = [
    body('name', 'Naam zaroori hai').not().isEmpty(),
    body('vendorId', 'Vendor zaroori hai').isMongoId(),
    body('category', 'Category zaroori hai').isMongoId(),
    body('brand', 'Brand zaroori hai').isMongoId(),
];

// POST - Create a new product
router.post('/', [auth, upload.any()], productValidationRules, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
    try {
        let finalImages = req.body.images ? JSON.parse(req.body.images) : [];
        let parsedVariations = req.body.variations ? JSON.parse(req.body.variations) : [];
        if (req.files && req.files.length > 0) {
            const variationImageFiles = {}; const mainImageFiles = [];
            for (const file of req.files) {
                if (file.fieldname.startsWith('variation_image_')) {
                    const index = file.fieldname.split('_')[2];
                    variationImageFiles[index] = file;
                } else if (file.fieldname === 'new_images') {
                    mainImageFiles.push(file);
                }
            }
            const mainImageUploads = mainImageFiles.map(file => uploadToCloudinary(file));
            const uploadedMainImages = await Promise.all(mainImageUploads);
            finalImages.push(...uploadedMainImages);
            for (let i = 0; i < parsedVariations.length; i++) {
                if (variationImageFiles[i]) {
                    const result = await uploadToCloudinary(variationImageFiles[i]);
                    parsedVariations[i].image = result;
                }
            }
        }
        const productData = { ...req.body, tags: req.body.tags ? JSON.parse(req.body.tags) : [], images: finalImages, variations: parsedVariations };
        const newProduct = new Product(productData);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        console.error("Product create karte waqt error:", err);
        if (err.name === 'ValidationError') { return res.status(400).json({ message: err.message }); }
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// PUT - Update an existing product
router.put('/:id', [auth, upload.any()], productValidationRules, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ msg: 'Product nahi mila' });
        
        // Step 1: Image handling (library images, new uploads, and deletions)
        let finalImages = req.body.images ? JSON.parse(req.body.images) : product.images;
        if (req.body.imagesToDelete) {
            const publicIdsToDelete = JSON.parse(req.body.imagesToDelete);
            if (publicIdsToDelete.length > 0) {
                await cloudinary.api.delete_resources(publicIdsToDelete);
            }
        }

        let parsedVariations = req.body.variations ? JSON.parse(req.body.variations) : product.variations;
        
        if (req.files && req.files.length > 0) {
            const variationImageFiles = {};
            const mainImageFiles = [];
            for (const file of req.files) {
                 if (file.fieldname.startsWith('variation_image_')) {
                    const index = file.fieldname.split('_')[2];
                    variationImageFiles[index] = file;
                } else if (file.fieldname === 'new_images') {
                    mainImageFiles.push(file);
                }
            }
            const mainImageUploads = mainImageFiles.map(file => uploadToCloudinary(file));
            const uploadedMainImages = await Promise.all(mainImageUploads);
            finalImages.push(...uploadedMainImages);

            for (let i = 0; i < parsedVariations.length; i++) {
                if (variationImageFiles[i]) {
                    if (parsedVariations[i].image && parsedVariations[i].image.public_id) {
                        await cloudinary.uploader.destroy(parsedVariations[i].image.public_id);
                    }
                    const result = await uploadToCloudinary(variationImageFiles[i]);
                    parsedVariations[i].image = result;
                }
            }
        }
        
        // Step 2: Product ke fields ko manually update karna
        product.name = req.body.name;
        product.description = req.body.description;
        product.productType = req.body.productType;
        product.status = req.body.status;
        product.inStock = req.body.inStock === 'true'; // Convert string to boolean
        product.category = req.body.category;
        product.brand = req.body.brand;
        product.vendorId = req.body.vendorId;
        product.sku = req.body.sku;

        // String "null" ya "" ko Number mein convert karein
        product.price = (req.body.price && req.body.price !== 'null') ? Number(req.body.price) : undefined;
        product.salePrice = (req.body.salePrice && req.body.salePrice !== 'null') ? Number(req.body.salePrice) : undefined;
        
        // Stringified arrays ko parse karein
        product.tags = req.body.tags ? JSON.parse(req.body.tags) : [];

        // Updated images aur variations ko set karein
        product.images = finalImages;
        product.variations = parsedVariations;

        // Step 3: Product save karein (ab pre-save hook priceRange update kar dega)
        await product.save();
        res.json(product);

    } catch (err) {
        console.error("Product update karte waqt error:", err);
         if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// DELETE a product
router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { return res.status(404).json({ msg: 'Product nahi mila' }); }
        const publicIdsToDelete = [];
        if (product.images && product.images.length > 0) {
            product.images.forEach(img => img.public_id && publicIdsToDelete.push(img.public_id));
        }
        if (product.variations && product.variations.length > 0) {
            product.variations.forEach(v => v.image && v.image.public_id && publicIdsToDelete.push(v.image.public_id));
        }
        if (publicIdsToDelete.length > 0) {
            try { await cloudinary.api.delete_resources(publicIdsToDelete); } catch (cloudinaryErr) { console.error("Cloudinary se image delete karte waqt error:", cloudinaryErr.message); }
        }
        await product.deleteOne();
        res.json({ msg: 'Product delete ho gaya' });
    } catch (err) {
        console.error("Product delete karte waqt error:", err.message);
        res.status(500).send('Server Error');
    }
});

// CSV Import Route
router.post('/import', [auth, upload.single('file')], async (req, res) => {
    if (!req.file) { return res.status(400).json({ msg: 'CSV file zaroori hai' }); }
    const products = [];
    const buffer = req.file.buffer;
    const stream = Readable.from(buffer.toString('utf8'));
    stream.pipe(csv()).on('data', (row) => {
        const productData = { name: row.name, description: row.description, price: parseFloat(row.price), salePrice: row.salePrice ? parseFloat(row.salePrice) : undefined, sku: row.sku, inStock: row.inStock ? row.inStock.toLowerCase() === 'true' : true, status: row.status || 'Published', category: row.category, brand: row.brand, vendorId: row.vendorId, images: row.images ? row.images.split(',').map(url => ({ public_id: 'csv_import', url: url.trim() })) : [], tags: row.tags ? row.tags.split(',').map(tag => tag.trim()) : [] };
        if (productData.name) { products.push(productData); }
    }).on('end', async () => {
        try {
            if (products.length > 0) {
                await Product.insertMany(products, { ordered: false });
                res.status(201).json({ msg: `${products.length} products kamyabi se import ho gaye!` });
            } else { res.status(400).json({ msg: 'CSV file mein koi valid product nahi mila.' }); }
        } catch (err) {
            console.error("CSV import ke waqt database error:", err);
            res.status(500).json({ msg: 'Database mein save karte waqt error hua.', error: err.message });
        }
    }).on('error', (err) => {
        console.error("CSV parse karte waqt error:", err);
        res.status(500).json({ msg: 'CSV file parhne mein error hua.', error: err.message });
    });
});

// CSV Export Route
router.get('/export/csv', auth, async (req, res) => {
    try {
        const products = await Product.find({}).populate('category').populate('brand', 'name').populate('vendorId', 'shopName');
        const getCategoryPath = async (category) => {
            let path = { superCategory: '', mainCategory: '', subCategory: '' };
            if (!category) return path;
            let hierarchy = []; let current = category; let depth = 0;
            while (current && depth < 5) {
                hierarchy.unshift(current.name);
                current = current.parent ? await Category.findById(current.parent) : null;
                depth++;
            }
            if (hierarchy.length > 0) path.subCategory = hierarchy.pop() || '';
            if (hierarchy.length > 0) path.mainCategory = hierarchy.pop() || '';
            if (hierarchy.length > 0) path.superCategory = hierarchy.pop() || '';
            return path;
        };
        let flattenedProducts = [];
        for (const product of products) {
            const categoryPath = await getCategoryPath(product.category);
            const commonData = { product_id: product._id, product_name: product.name, description: product.description, sku: product.sku, status: product.status, brand_name: product.brand?.name || '', vendor_name: product.vendorId?.shopName || '', super_category: categoryPath.superCategory, main_category: categoryPath.mainCategory, sub_category: categoryPath.subCategory, tags: product.tags?.join(','), main_images: product.images?.map(img => img.url).join(','), price: product.price, sale_price: product.salePrice, stock: product.inStock ? 'In Stock' : 'Out of Stock' };
            if (product.variations && product.variations.length > 0) {
                for (const variation of product.variations) {
                    flattenedProducts.push({ ...commonData, type: 'variation', variation_attribute: variation.attribute, variation_value: variation.value, variation_price: variation.price, variation_sale_price: variation.salePrice, variation_stock: variation.stock, variation_sku: variation.sku, variation_image: variation.image?.url || '' });
                }
            } else { flattenedProducts.push({ ...commonData, type: 'simple' }); }
        }
        const json2csvParser = new Parser();
        const csvData = json2csvParser.parse(flattenedProducts);
        res.header('Content-Type', 'text/csv');
        res.attachment(`products-export-${Date.now()}.csv`);
        res.send(csvData);
    } catch (err) {
        console.error("CSV export ke waqt error:", err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;