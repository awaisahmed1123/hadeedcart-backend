const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product.js');
const Brand = require('../models/Brand.js');
const Category = require('../models/Category.js');
const upload = require('../middleware/multer.js');
const cloudinary = require('../config/cloudinary');
const csv = require('csv-parser');
const { Readable } = require('stream');
const auth = require('../middleware/auth.js');
const { Parser } = require('json2csv'); // Naya package

const uploadToCloudinary = async (file) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    let dataURI = "data:" + file.mimetype + ";base64," + b64;
    const result = await cloudinary.uploader.upload(dataURI, { folder: "hadeedcart_products" });
    return { public_id: result.public_id, url: result.secure_url };
};

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

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('brand', 'name')
            .populate('vendorId', 'shopName')
            .populate('category');
        if (!product) { return res.status(404).json({ msg: 'Product nahi mila' }); }
        const getCategoryPath = async (categoryId) => {
            let path = [];
            if (!categoryId) return path;
            let currentCategory = await Category.findById(categoryId);
            let depth = 0;
            const maxDepth = 10; 
            while (currentCategory && depth < maxDepth) {
                path.unshift(currentCategory);
                if (currentCategory.parent) {
                    currentCategory = await Category.findById(currentCategory.parent);
                } else {
                    currentCategory = null;
                }
                depth++;
            }
            return path;
        };
        const productObject = product.toObject();
        if (product.category && product.category._id) {
            productObject.categoryPath = await getCategoryPath(product.category._id);
        } else {
            productObject.categoryPath = [];
        }
        res.json(productObject);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

const productValidationRules = [
    body('name', 'Naam zaroori hai').not().isEmpty(),
    body('vendorId', 'Vendor zaroori hai').not().isEmpty(),
    body('category', 'Category zaroori hai').not().isEmpty(),
    body('brand', 'Brand zaroori hai').not().isEmpty(),
];

router.post('/', [auth, upload.any()], productValidationRules, async (req, res) => {
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
        const productData = { name, description, category, inStock, sku, status, brand: brand && mongoose.Types.ObjectId.isValid(brand) ? brand : null, vendorId, variations: parsedVariations, tags: tags ? JSON.parse(tags) : [], images: mainImages };
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

router.put('/:id', [auth, upload.any()], productValidationRules, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
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
        product.name = name; product.description = description; product.category = category; product.brand = brand && mongoose.Types.ObjectId.isValid(brand) ? brand : null; product.inStock = inStock; product.vendorId = vendorId; product.sku = sku; product.status = status; product.tags = tags ? JSON.parse(tags) : []; product.variations = parsedVariations; product.price = price ? price : undefined; product.salePrice = salePrice ? salePrice : undefined;
        await product.save();
        res.json(product);
    } catch (err) {
        console.error("Product update karte waqt error:", err.message);
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { return res.status(404).json({ msg: 'Product nahi mila' }); }
        if (product.images && product.images.length > 0) {
            const publicIds = product.images.map(img => img.public_id).filter(id => id);
            if (publicIds.length > 0) { await cloudinary.api.delete_resources(publicIds); }
        }
        if (product.variations && product.variations.length > 0) {
            const variationImagePublicIds = product.variations.map(v => v.image && v.image.public_id).filter(id => id);
            if (variationImagePublicIds.length > 0) { await cloudinary.api.delete_resources(variationImagePublicIds); }
        }
        await product.deleteOne();
        res.json({ msg: 'Product delete ho gaya' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.patch('/quick-edit/:id', [auth, upload.single('image')], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { return res.status(404).json({ msg: 'Product nahi mila' }); }
        const { price, inStock } = req.body;
        if (price) { product.price = price; }
        if (inStock !== undefined) { product.inStock = (inStock === 'true'); }
        if (req.file) {
            if (product.images && product.images.length > 0 && product.images[0].public_id) {
                await cloudinary.uploader.destroy(product.images[0].public_id);
            }
            const result = await uploadToCloudinary(req.file);
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
                await Product.insertMany(products);
                res.status(201).json({ msg: `${products.length} products kamyabi se import ho gaye!` });
            } else {
                res.status(400).json({ msg: 'CSV file mein koi valid product nahi mila.' });
            }
        } catch (err) {
            console.error("CSV import ke waqt database error:", err);
            res.status(500).json({ msg: 'Database mein save karte waqt error hua.', error: err.message });
        }
    }).on('error', (err) => {
        console.error("CSV parse karte waqt error:", err);
        res.status(500).json({ msg: 'CSV file parhne mein error hua.', error: err.message });
    });
});

// NAYI CSV EXPORT WALI ROUTE
router.get('/export', auth, async (req, res) => {
    try {
        const products = await Product.find({}).populate('category').populate('brand', 'name').populate('vendorId', 'shopName');
        const getCategoryPath = async (category) => {
            let path = { superCategory: '', mainCategory: '', subCategory: '' };
            if (!category) return path;
            let hierarchy = [];
            let current = category;
            let depth = 0;
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
            const commonData = {
                product_id: product._id,
                product_name: product.name,
                description: product.description,
                sku: product.sku,
                status: product.status,
                brand_name: product.brand?.name || '',
                vendor_name: product.vendorId?.shopName || '',
                super_category: categoryPath.superCategory,
                main_category: categoryPath.mainCategory,
                sub_category: categoryPath.subCategory,
                tags: product.tags?.join(','),
                main_images: product.images?.map(img => img.url).join(','),
                price: product.price, // Base price for simple products
                sale_price: product.salePrice, // Base sale price
                stock: product.inStock ? 'In Stock' : 'Out of Stock' // Base stock status
            };
            if (product.variations && product.variations.length > 0) {
                for (const variation of product.variations) {
                    flattenedProducts.push({
                        ...commonData,
                        type: 'variation',
                        variation_attribute: variation.attribute,
                        variation_value: variation.value,
                        variation_price: variation.price,
                        variation_sale_price: variation.salePrice,
                        variation_stock: variation.stock,
                        variation_sku: variation.sku,
                        variation_image: variation.image?.url || '',
                    });
                }
            } else {
                flattenedProducts.push({ ...commonData, type: 'simple' });
            }
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