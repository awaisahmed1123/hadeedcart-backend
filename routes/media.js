// routes/media.js

const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');

// @route   GET /api/media
// @desc    Get all images from Cloudinary
// @access  Private (Admin Only)
router.get('/', auth, async (req, res) => {
    try {
        // Dono folders se images ek saath fetch karein
        const [productImages, bannerImages] = await Promise.all([
            cloudinary.v2.search
                .expression('folder:hadeedcart_products')
                .sort_by('created_at', 'desc')
                .max_results(100) // Aap is limit ko barha sakte hain
                .execute(),
            cloudinary.v2.search
                .expression('folder:hadeedcart_banners')
                .sort_by('created_at', 'desc')
                .max_results(50)
                .execute()
        ]);

        // Dono results ko milakar ek array banayein
        const allImages = [...productImages.resources, ...bannerImages.resources];
        
        // Nayi images ko pehle dikhane ke liye sort karein
        allImages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(allImages);

    } catch (err) {
        console.error("Cloudinary se images fetch karte waqt error:", err);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/media
// @desc    Delete an image from Cloudinary
// @access  Private (Admin Only)
router.delete('/', auth, async (req, res) => {
    const { public_id } = req.body;

    if (!public_id) {
        return res.status(400).json({ msg: 'Image public_id zaroori hai' });
    }

    try {
        // Cloudinary se image delete karein
        const result = await cloudinary.v2.uploader.destroy(public_id);

        if (result.result !== 'ok') {
            throw new Error('Cloudinary se image delete nahi ho saki.');
        }

        res.json({ msg: 'Image kamyabi se delete ho gayi' });

    } catch (err) {
        console.error("Cloudinary se image delete karte waqt error:", err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;