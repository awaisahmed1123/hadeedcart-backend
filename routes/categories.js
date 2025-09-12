const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');

// GET all categories (FINAL, CORRECTED VERSION)
router.get('/', async (req, res) => {
  try {
    const { parentName } = req.query;
    let query = {}; // Shuru mein query khali hai

    // Agar Flutter App se parentName aa raha hai
    if (parentName) {
      // Us naam ki parent category dhoondein (capital/small harf ko ignore karke)
      const parentCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${parentName}$`, 'i') } 
      });
      
      if (parentCategory) {
        // Agar parent mil jaye, to uske bachon ko dhoondne ke liye query banayein
        query.parent = parentCategory._id;
      } else {
        // Agar parent na mile, to khali result bhejein
        return res.status(200).json([]);
      }
    }
    // Agar koi parentName nahi hai (maslan Admin Panel se request), 
    // to query khali rahegi aur saari categories fetch hongi.

    const categories = await Category.find(query).sort({ name: 1 });
    res.status(200).json(categories);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// POST a new category
router.post('/', [ body('name', 'Naam zaroori hai').not().isEmpty().trim() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const { name, parent, image } = req.body;
    try {
        let category = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (category) return res.status(400).json({ msg: 'Yeh category pehle se mojood hai' });

        category = new Category({ name, parent: parent || null, image });
        await category.save();
        res.status(201).json(category);
    } catch (err) { res.status(500).send('Server Error'); }
});

// PUT (Update) a category by ID
router.put('/:id', [ body('name', 'Naam zaroori hai').not().isEmpty().trim() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { name, parent, image } = req.body;
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            { name, parent: parent || null, image },
            { new: true }
        );
        if (!updatedCategory) return res.status(404).json({ msg: 'Category nahi mili' });
        res.json(updatedCategory);
    } catch (err) { res.status(500).send('Server Error'); }
});

// DELETE a category by ID
router.delete('/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ msg: 'Category nahi mili' });

        const children = await Category.find({ parent: category._id });
        if (children.length > 0) {
            return res.status(400).json({ msg: 'Isay delete nahi kar sakte, pehle iski child categories delete karein' });
        }

        await Category.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Category delete ho gayi' });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;