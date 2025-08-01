const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  price: { type: Number, required: true, min: 0, default: 0 },

  availableStock: { type: Number, required: true, default: 0, min: 0 },
  totalStock: { type: Number, required: true, default: 0, min: 0 },

  location: { type: String }
});

itemSchema.index({ stockId: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Item', itemSchema);