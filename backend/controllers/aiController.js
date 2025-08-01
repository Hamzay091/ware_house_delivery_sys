const Delivery = require('../models/delivery'); 
const fetch = require('node-fetch');

exports.getOptimizedRoute = async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.params.id).populate({ path: 'items.itemId', populate: { path: 'stockId', model: 'Stock' } });
        if (!delivery) return res.status(404).send('Delivery not found');

        const addresses = [{ address: "Jinnah Park, Gujranwala, Pakistan" }];
        addresses.push({ address: delivery.customerAddress });

        const response = await fetch('http://127.0.0.1:5001/optimize-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses })
        });
        
        const data = await response.json();

        if (!response.ok) {
            const errorMessage = encodeURIComponent(`AI Service Error: ${data.message || 'Unknown error'}`);
            return res.redirect(`/manager-dashboard?error=${errorMessage}`);
        }

        const routeJSON = JSON.stringify(data.optimized_route).replace(/</g, '\\u003c');
        
        res.render('optimized-route', { delivery, routeJSON });

    } catch (error) {
        console.error("Error optimizing route:", error);
        const errorMessage = encodeURIComponent("Fatal Error: Could not connect to the AI service. Please ensure it is running.");
        res.redirect(`/manager-dashboard?error=${errorMessage}`);
    }
};