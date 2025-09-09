const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Brand = require('../models/Brand');

// @route   GET api/brands
// @desc    Get all brands, sorted alphabetically
router.get('/', async (req, res) => {
  try {
    const brands = await Brand.find({}).sort({ name: 1 });
    res.json(brands);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   POST api/brands
// @desc    Add a new brand
router.post('/', [ body('name', 'Brand ka naam zaroori hai').not().isEmpty().trim() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    try {
        let brand = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (brand) return res.status(400).json({ msg: 'Yeh brand pehle se mojood hai' });
        
        brand = new Brand({ name });
        await brand.save();
        res.status(201).json(brand);
    } catch (err) { res.status(500).send('Server Error'); }
});

// @route   PUT api/brands/:id
// @desc    Update a brand
router.put('/:id', [ body('name', 'Brand ka naam zaroori hai').not().isEmpty().trim() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const updatedBrand = await Brand.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true });
        if (!updatedBrand) return res.status(404).json({ msg: 'Brand nahi mila' });
        res.json(updatedBrand);
    } catch (err) { res.status(500).send('Server Error'); }
});

// @route   DELETE api/brands/:id
// @desc    Delete a brand
router.delete('/:id', async (req, res) => {
    try {
        const brand = await Brand.findByIdAndDelete(req.params.id);
        if (!brand) return res.status(404).json({ msg: 'Brand nahi mila' });
        res.json({ msg: 'Brand delete ho gaya' });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;