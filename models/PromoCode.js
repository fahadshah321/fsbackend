const mongoose = require("mongoose");

// NEW: Promo code model
const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    categories: [{ type: String, required: true }], // category names this promo applies to
    isHidden: { type: Boolean, default: false }, // when true, do not show in hero/marketing
    isActive: { type: Boolean, default: true }, // soft-disable without deleting
    startsAt: { type: Date },
    endsAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PromoCode", promoCodeSchema);

