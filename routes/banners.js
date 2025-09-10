// routes/banners.js

const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const auth = require('../middleware/auth');
const upload = require('../middleware/multer');
const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = async (file) => {
    const b64 = Buffer.from(file.buffer).toString("base64");
    let dataURI = "data:" + file.mimetype + ";base64," + b64;
    const result = await cloudinary.uploader.upload(dataURI, { folder: "hadeedcart_banners" });
    return { public_id: result.public_id, url: result.secure_url };
};

router.get('/', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
        res.json(banners);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/', [auth, upload.single('image')], async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'Image zaroori hai' });
    }
    const { type, link } = req.body;
    if (!type) {
        return res.status(400).json({ msg: 'Banner type zaroori hai' });
    }

    try {
        const imageResult = await uploadToCloudinary(req.file);
        const newBanner = new Banner({
            image: imageResult,
            type,
            link
        });
        await newBanner.save();
        res.status(201).json(newBanner);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(4404).json({ msg: 'Banner nahi mila' });
        }

        await cloudinary.uploader.destroy(banner.image.public_id);
        await Banner.findByIdAndDelete(req.params.id);
        
        res.json({ msg: 'Banner delete ho gaya' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;