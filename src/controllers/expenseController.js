const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getExpenses = async (req, res, next) => {
  try {
    const { category, startDate, endDate } = req.query;
    const where = { hotelId: req.user.hotelId };
    if (category) where.category = category;
    if (startDate && endDate) where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
    res.json(expenses);
  } catch (error) { next(error); }
};

const createExpense = async (req, res, next) => {
  try {
    const { category, description, amount, date, vendor, paymentMethod, notes } = req.body;
    const expense = await prisma.expense.create({
      data: { category, description, amount: parseFloat(amount), date: new Date(date), vendor, paymentMethod, notes, hotelId: req.user.hotelId },
    });
    res.status(201).json(expense);
  } catch (error) { next(error); }
};

const updateExpense = async (req, res, next) => {
  try {
    const { category, description, amount, date, vendor, paymentMethod, notes } = req.body;
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { category, description, amount: amount ? parseFloat(amount) : undefined, date: date ? new Date(date) : undefined, vendor, paymentMethod, notes },
    });
    res.json(expense);
  } catch (error) { next(error); }
};

const deleteExpense = async (req, res, next) => {
  try { await prisma.expense.delete({ where: { id: req.params.id } }); res.json({ message: 'Expense deleted' }); } catch (error) { next(error); }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
