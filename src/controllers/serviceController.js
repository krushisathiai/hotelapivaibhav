const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getServices = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({ where: { hotelId: req.user.hotelId }, orderBy: { name: 'asc' } });
    res.json(services);
  } catch (error) { next(error); }
};

const createService = async (req, res, next) => {
  try {
    const { name, description, price, taxRate } = req.body;
    const service = await prisma.service.create({
      data: { name, description, price: parseFloat(price), taxRate: taxRate ? parseFloat(taxRate) : 18, hotelId: req.user.hotelId },
    });
    res.status(201).json(service);
  } catch (error) { next(error); }
};

const updateService = async (req, res, next) => {
  try {
    const service = await prisma.service.update({ where: { id: req.params.id }, data: req.body });
    res.json(service);
  } catch (error) { next(error); }
};

const addServiceCharge = async (req, res, next) => {
  try {
    const { serviceId, bookingId, quantity, notes } = req.body;
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const charge = await prisma.serviceCharge.create({
      data: { serviceId, bookingId, quantity: parseInt(quantity) || 1, amount: service.price * (parseInt(quantity) || 1), notes },
      include: { service: { select: { name: true } } },
    });
    res.status(201).json(charge);
  } catch (error) { next(error); }
};

const getServiceCharges = async (req, res, next) => {
  try {
    const charges = await prisma.serviceCharge.findMany({
      where: { bookingId: req.params.bookingId },
      include: { service: { select: { name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(charges);
  } catch (error) { next(error); }
};

module.exports = { getServices, createService, updateService, addServiceCharge, getServiceCharges };
