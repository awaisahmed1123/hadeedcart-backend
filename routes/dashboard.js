const express = require('express');
const router = express.Router();

// Zaroori Models
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Order = require('../models/Order');
const Brand = require('../models/Brand');       // MISSING THA
const Category = require('../models/Category'); // MISSING THA

// @route   GET api/dashboard/stats
// @desc    Get all stats for admin dashboard
// @access  Private
router.get('/stats', async (req, res) => {
    try {
        // Simple counts
        const totalProducts = await Product.countDocuments();
        const totalVendors = await Vendor.countDocuments();
        const totalCustomers = await User.countDocuments(); // Isko aap role ke hisab se bhi filter kar sakte hain
        const totalOrders = await Order.countDocuments();
        const productsOutOfStock = await Product.countDocuments({ inStock: false });

        // === YEH LINES ADD KI GAYI HAIN ===
        const totalBrands = await Brand.countDocuments();
        const totalCategories = await Category.countDocuments();
        const totalUsers = totalCustomers; // Filhal total users aur customers barabar hain

        // Total Earnings (sirf 'Delivered' orders ki qeemat)
        const earningsResult = await Order.aggregate([
            { $match: { orderStatus: 'Delivered' } },
            { $group: { _id: null, totalEarnings: { $sum: '$totalPrice' } } }
        ]);
        const totalEarnings = earningsResult.length > 0 ? earningsResult[0].totalEarnings : 0;
        
        // Sales Chart ke liye data (pichle 7 din) - Iski zaroorat ab frontend par nahi hai, lekin backend se bhejna acha hai
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const salesChartData = await Order.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, orderStatus: 'Delivered' } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                dailySales: { $sum: '$totalPrice' }
            }},
            { $sort: { _id: 1 } }
        ]);

        // Recent 5 Orders - Iski zaroorat bhi ab frontend par nahi hai
        const recentOrders = await Order.find()
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        // Products by Vendor
        const productsByVendor = await Product.aggregate([
            { $group: { _id: '$vendorId', productCount: { $sum: 1 } } },
            { $lookup: { from: 'vendors', localField: '_id', foreignField: '_id', as: 'vendorInfo' } },
            { $unwind: '$vendorInfo' },
            { $project: { _id: 0, vendorName: '$vendorInfo.shopName', productCount: 1 } }
        ]);

        // Final JSON response
        res.json({
            totalProducts,
            totalVendors,
            totalCustomers,
            totalOrders,
            productsOutOfStock,
            totalEarnings,
            salesChartData,
            recentOrders,
            productsByVendor,
            // === NAYE STATS RESPONSE MEIN SHAMIL KIYE GAYE HAIN ===
            totalBrands,
            totalCategories,
            totalUsers
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;