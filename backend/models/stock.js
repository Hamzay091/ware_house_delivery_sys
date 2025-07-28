const mongoose = require('mongoose');
const stockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String }
});
module.exports = mongoose.model('Stock', stockSchema);