const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getItems = async (req, res, next) => {
  try {
    const { category, lowStock } = req.query;
    const where = { hotelId: req.user.hotelId };
    if (category) where.category = category;
    const items = await prisma.inventoryItem.findMany({
      where, include: { supplier: { select: { name: true } } }, orderBy: { name: 'asc' },
    });
    if (lowStock === 'true') {
      return res.json(items.filter(i => i.quantity <= i.minStock));
    }
    res.json(items);
  } catch (error) { next(error); }
};

const createItem = async (req, res, next) => {
  try {
    const { name, category, quantity, unit, minStock, purchasePrice, sellingPrice, supplierId } = req.body;
    const item = await prisma.inventoryItem.create({
      data: { name, category, quantity: parseInt(quantity) || 0, unit, minStock: parseInt(minStock) || 5, purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null, sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null, supplierId, hotelId: req.user.hotelId },
    });
    res.status(201).json(item);
  } catch (error) { next(error); }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (error) { next(error); }
};

const stockTransaction = async (req, res, next) => {
  try {
    const { itemId, type, quantity, notes } = req.body;
    const txn = await prisma.$transaction(async (tx) => {
      const newTxn = await tx.inventoryTransaction.create({ data: { itemId, type, quantity: parseInt(quantity), notes } });
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
      const newQty = type === 'STOCK_IN' ? item.quantity + parseInt(quantity) : item.quantity - parseInt(quantity);
      await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: Math.max(0, newQty) } });
      return newTxn;
    });
    res.status(201).json(txn);
  } catch (error) { next(error); }
};

const deleteItem = async (req, res, next) => {
  try { await prisma.inventoryItem.delete({ where: { id: req.params.id } }); res.json({ message: 'Item deleted' }); } catch (error) { next(error); }
};

// Suppliers
const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ where: { hotelId: req.user.hotelId }, orderBy: { name: 'asc' } });
    res.json(suppliers);
  } catch (error) { next(error); }
};

const createSupplier = async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.create({ data: { ...req.body, hotelId: req.user.hotelId } });
    res.status(201).json(supplier);
  } catch (error) { next(error); }
};

module.exports = { getItems, createItem, updateItem, stockTransaction, deleteItem, getSuppliers, createSupplier };
