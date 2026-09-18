const Delivery = require('../models/delivery');

// Node 18+ ships a global fetch; fall back to node-fetch on older runtimes.
const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';
const WAREHOUSE_ORIGIN = process.env.WAREHOUSE_ORIGIN_ADDRESS || 'Jinnah Park, Gujranwala, Pakistan';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 15000;

exports.getOptimizedRoute = async (req, res, next) => {
    try {
        const delivery = await Delivery.findById(req.params.id).populate({
            path: 'items.itemId',
            model: 'Item',
            populate: { path: 'stockId', model: 'Stock' }
        });

        if (!delivery) {
            req.flash('error', 'That delivery no longer exists.');
            return res.redirect('/manager-dashboard');
        }

        const addresses = [
            { address: WAREHOUSE_ORIGIN },
            { address: delivery.customerAddress }
        ];

        // Without a timeout a stalled AI service would hang the request until
        // the browser gave up.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        let data;
        try {
            const response = await fetchFn(`${AI_SERVICE_URL}/optimize-route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses }),
                signal: controller.signal
            });

            data = await response.json().catch(() => ({}));

            if (!response.ok) {
                req.flash('error', `Route service error: ${data.message || response.statusText}`);
                return res.redirect('/manager-dashboard');
            }
        } catch (fetchError) {
            const reason = fetchError.name === 'AbortError'
                ? 'The route service did not respond in time.'
                : 'Could not reach the route service. Check that it is running on ' + AI_SERVICE_URL + '.';
            req.flash('error', reason);
            return res.redirect('/manager-dashboard');
        } finally {
            clearTimeout(timer);
        }

        const route = Array.isArray(data.optimized_route) ? data.optimized_route : [];
        if (route.length === 0) {
            req.flash('error', 'The route service could not geocode this address.');
            return res.redirect('/manager-dashboard');
        }

        res.render('optimized-route', {
            title: 'Optimised route',
            delivery,
            route,
            routeJSON: JSON.stringify(route).replace(/</g, '\\u003c')
        });
    } catch (error) {
        next(error);
    }
};
