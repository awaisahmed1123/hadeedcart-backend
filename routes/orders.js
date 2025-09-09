const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// @route   GET api/orders
// @desc    Get all orders (for Admin)
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'name email') // User ka naam aur email bhi saath laye
            .sort({ createdAt: -1 }); // Naye orders sab se pehle
        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/orders/:id
// @desc    Get single order details (for Admin)
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone');
            // Hum yahan products ki details bhi populate kar sakte hain

        if (!order) {
            return res.status(404).json({ msg: 'Order nahi mila' });
        }
        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/orders/:id/status
// @desc    Update order status (for Admin)
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ msg: 'Invalid status' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ msg: 'Order nahi mila' });
        }

        order.orderStatus = status;

        // Agar status 'Delivered' hai to delivery date set karein
        if (status === 'Delivered') {
            order.isDelivered = true;
            order.deliveredAt = Date.now();
        } else {
            order.isDelivered = false;
            order.deliveredAt = null;
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;