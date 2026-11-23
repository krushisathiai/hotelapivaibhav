const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getStaff = async (req, res, next) => {
  try {
    const staff = await prisma.staff.findMany({ where: { hotelId: req.user.hotelId }, orderBy: { name: 'asc' } });
    res.json(staff);
  } catch (error) { next(error); }
};

const createStaff = async (req, res, next) => {
  try {
    const { name, email, phone, department, position, salary } = req.body;
    const staff = await prisma.staff.create({
      data: { name, email, phone, department, position, salary: salary ? parseFloat(salary) : null, hotelId: req.user.hotelId },
    });
    res.status(201).json(staff);
  } catch (error) { next(error); }
};

const updateStaff = async (req, res, next) => {
  try {
    const staff = await prisma.staff.update({ where: { id: req.params.id }, data: req.body });
    res.json(staff);
  } catch (error) { next(error); }
};

const deleteStaff = async (req, res, next) => {
  try { await prisma.staff.delete({ where: { id: req.params.id } }); res.json({ message: 'Staff deleted' }); } catch (error) { next(error); }
};

module.exports = { getStaff, createStaff, updateStaff, deleteStaff };
