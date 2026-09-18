const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', required: true },
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0, default: 0 },

  // totalStock is cumulative (everything ever received); availableStock is
  // what is physically on the shelf right now.
  availableStock: { type: Number, required: true, default: 0, min: 0 },
  totalStock: { type: Number, required: true, default: 0, min: 0 },

  location: { type: String, trim: true },

  // Written by the Python forecaster (python-ai-services/forecaster.py).
  // Declared here so the values survive a Mongoose save and are typed.
  forecast: {
    dailyBurnRate: { type: Number },
    daysOfStockLeft: { type: Number },
    lastUpdated: { type: Date }
  }
}, { timestamps: true });

itemSchema.index({ stockId: 1, sku: 1 }, { unique: true });
itemSchema.index({ name: 1 });
itemSchema.index({ availableStock: 1 });

module.exports = mongoose.model('Item', itemSchema);
