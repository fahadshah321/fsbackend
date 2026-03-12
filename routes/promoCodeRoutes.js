const express = require("express");
const router = express.Router();

const PromoCode = require("../models/PromoCode");
const Category = require("../models/Category");
const { authMiddleware, roleCheck } = require("../middlewares/auth");

// Helper: build human-readable category string, e.g. "iPhone, Samsung and Pixel"
const buildCategoryLabel = (categories) => {
  if (!categories || categories.length === 0) return "";
  if (categories.length === 1) return categories[0];
  if (categories.length === 2) return `${categories[0]} and ${categories[1]}`;
  const allButLast = categories.slice(0, -1).join(", ");
  const last = categories[categories.length - 1];
  return `${allButLast} and ${last}`;
};

// NEW: Public endpoint for hero section - currently active & visible promo
router.get("/public/active", async (req, res) => {
  try {
    const now = new Date();
    const promo = await PromoCode.findOne({
      isActive: true,
      isHidden: false,
      $or: [{ startsAt: { $lte: now } }, { startsAt: null }, { startsAt: { $exists: false } }],
      $or: [{ endsAt: { $gte: now } }, { endsAt: null }, { endsAt: { $exists: false } }],
    }).sort({ createdAt: -1 });

    if (!promo) return res.json(null);

    res.json({
      ...promo.toObject(),
      categoryLabel: buildCategoryLabel(promo.categories),
    });
  } catch (error) {
    console.error("Error fetching active promo code:", error);
    res.status(500).json({ message: "Failed to fetch active promo code" });
  }
});

// NEW: Create promo code
router.post("/", authMiddleware, roleCheck(["admin"]), async (req, res) => {
  try {
    const { code, description, discountPercent, categories, isHidden, isActive, startsAt, endsAt } = req.body;

    if (!code || discountPercent == null || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: "code, discountPercent and at least one category are required" });
    }

    const normalizedCode = String(code).trim().toUpperCase();

    const existing = await PromoCode.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(409).json({ message: "Promo code already exists" });
    }

    const promo = new PromoCode({
      code: normalizedCode,
      description,
      discountPercent,
      categories,
      isHidden: !!isHidden,
      isActive: isActive !== false,
      startsAt,
      endsAt,
    });

    await promo.save();

    res.status(201).json(promo);
  } catch (error) {
    console.error("Error creating promo code:", error);
    res.status(500).json({ message: "Failed to create promo code" });
  }
});

// NEW: List promo codes (for dashboard)
// Only return promos that are NOT fully deleted (isActive !== false)
// so that "deleted" promo codes disappear from the admin list.
router.get("/", authMiddleware, roleCheck(["admin"]), async (req, res) => {
  try {
    const promos = await PromoCode.find({
      $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }],
    }).sort({ createdAt: -1 });
    res.json(promos);
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    res.status(500).json({ message: "Failed to fetch promo codes" });
  }
});

// NEW: Get a single promo code
router.get("/:id", authMiddleware, roleCheck(["admin"]), async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: "Promo code not found" });
    res.json(promo);
  } catch (error) {
    console.error("Error fetching promo code:", error);
    res.status(500).json({ message: "Failed to fetch promo code" });
  }
});

// NEW: Update promo code
router.put("/:id", authMiddleware, roleCheck(["admin"]), async (req, res) => {
  try {
    const { code, description, discountPercent, categories, isHidden, isActive, startsAt, endsAt } = req.body;

    const update = {};
    if (code != null) update.code = String(code).trim().toUpperCase();
    if (description != null) update.description = description;
    if (discountPercent != null) update.discountPercent = discountPercent;
    if (Array.isArray(categories) && categories.length > 0) update.categories = categories;
    if (isHidden != null) update.isHidden = isHidden;
    if (isActive != null) update.isActive = isActive;
    if (startsAt !== undefined) update.startsAt = startsAt;
    if (endsAt !== undefined) update.endsAt = endsAt;

    const promo = await PromoCode.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!promo) return res.status(404).json({ message: "Promo code not found" });

    res.json(promo);
  } catch (error) {
    console.error("Error updating promo code:", error);
    res.status(500).json({ message: "Failed to update promo code" });
  }
});

// NEW: Delete promo code permanently
router.delete("/:id", authMiddleware, roleCheck(["admin"]), async (req, res) => {
  try {
    const deleted = await PromoCode.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Promo code not found" });
    res.json({ message: "Promo code deleted" });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    res.status(500).json({ message: "Failed to delete promo code" });
  }
});

// NEW: Public endpoint for hero section - currently active & visible promo
router.get("/public/active", async (req, res) => {
  try {
    const now = new Date();
    const promo = await PromoCode.findOne({
      isActive: true,
      isHidden: false,
      $or: [{ startsAt: { $lte: now } }, { startsAt: null }, { startsAt: { $exists: false } }],
      $or: [{ endsAt: { $gte: now } }, { endsAt: null }, { endsAt: { $exists: false } }],
    }).sort({ createdAt: -1 });

    if (!promo) return res.json(null);

    res.json({
      ...promo.toObject(),
      categoryLabel: buildCategoryLabel(promo.categories),
    });
  } catch (error) {
    console.error("Error fetching active promo code:", error);
    res.status(500).json({ message: "Failed to fetch active promo code" });
  }
});

// NEW: Validate promo code at checkout
router.post("/validate", async (req, res) => {
  try {
    const { code, items } = req.body; // items: [{ productId, category, price, quantity }]

    if (!code || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "code and items are required" });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const now = new Date();

    const promo = await PromoCode.findOne({
      code: normalizedCode,
      isActive: true,
      $or: [{ startsAt: { $lte: now } }, { startsAt: null }, { startsAt: { $exists: false } }],
      $or: [{ endsAt: { $gte: now } }, { endsAt: null }, { endsAt: { $exists: false } }],
    });

    if (!promo) {
      return res.status(404).json({ message: "Invalid or expired promo code" });
    }

    const applicableCategories = new Set(promo.categories);
    let eligibleSubtotal = 0;

    for (const item of items) {
      if (!item) continue;
      const cat = item.category;
      if (cat && applicableCategories.has(cat)) {
        const lineTotal = (item.price || 0) * (item.quantity || 1);
        eligibleSubtotal += lineTotal;
      }
    }

    if (eligibleSubtotal <= 0) {
      return res.status(400).json({ message: "Promo code does not apply to selected products" });
    }

    const discountAmount = (eligibleSubtotal * promo.discountPercent) / 100;

    res.json({
      promo: {
        id: promo._id,
        code: promo.code,
        discountPercent: promo.discountPercent,
        categories: promo.categories,
      },
      eligibleSubtotal,
      discountAmount,
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    res.status(500).json({ message: "Failed to validate promo code" });
  }
});

module.exports = router;

