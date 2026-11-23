const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getHotel = async (req, res, next) => {
  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: req.user.hotelId } });
    if (!hotel) return res.status(404).json({ message: 'Hotel not found' });
    res.json(hotel);
  } catch (error) { next(error); }
};

const updateHotel = async (req, res, next) => {
  try {
    const hotel = await prisma.hotel.update({ where: { id: req.user.hotelId }, data: req.body });
    res.json(hotel);
  } catch (error) { next(error); }
};

// User management
const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { hotelId: req.user.hotelId },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) { next(error); }
};

const updateUser = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (error) { next(error); }
};

module.exports = { getHotel, updateHotel, getUsers, updateUser };
