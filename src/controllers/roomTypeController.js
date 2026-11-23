const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getRoomTypes = async (req, res, next) => {
  try {
    const types = await prisma.roomType.findMany({
      where: { hotelId: req.user.hotelId },
      include: { _count: { select: { rooms: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (error) { next(error); }
};

const createRoomType = async (req, res, next) => {
  try {
    const { name, description, basePrice, capacity, beds, amenities } = req.body;
    const type = await prisma.roomType.create({
      data: { name, description, basePrice: parseFloat(basePrice), capacity: parseInt(capacity) || 2, beds: parseInt(beds) || 1, amenities: amenities || [], hotelId: req.user.hotelId },
    });
    res.status(201).json(type);
  } catch (error) { next(error); }
};

const updateRoomType = async (req, res, next) => {
  try {
    const { name, description, basePrice, capacity, beds, amenities, isActive } = req.body;
    const type = await prisma.roomType.update({
      where: { id: req.params.id },
      data: { name, description, basePrice: basePrice ? parseFloat(basePrice) : undefined, capacity: capacity ? parseInt(capacity) : undefined, beds: beds ? parseInt(beds) : undefined, amenities, isActive },
    });
    res.json(type);
  } catch (error) { next(error); }
};

const deleteRoomType = async (req, res, next) => {
  try {
    await prisma.roomType.delete({ where: { id: req.params.id } });
    res.json({ message: 'Room type deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { getRoomTypes, createRoomType, updateRoomType, deleteRoomType };
