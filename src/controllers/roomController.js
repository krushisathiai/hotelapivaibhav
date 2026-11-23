const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all rooms
const getRooms = async (req, res, next) => {
  try {
    const { status, type, floor, search } = req.query;
    const where = { hotelId: req.user.hotelId };
    if (status) where.status = status;
    if (type) where.roomTypeId = type;
    if (floor) where.floor = parseInt(floor);
    if (search) where.number = { contains: search, mode: 'insensitive' };

    const rooms = await prisma.room.findMany({
      where,
      include: { roomType: true },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
    res.json(rooms);
  } catch (error) { next(error); }
};

// Get single room
const getRoom = async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
          include: { guest: { select: { firstName: true, lastName: true } } },
          orderBy: { checkInDate: 'desc' },
          take: 5,
        },
      },
    });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) { next(error); }
};

// Create room
const createRoom = async (req, res, next) => {
  try {
    const { number, roomNumber, floor, roomTypeId, status, cleanliness, notes } = req.body;
    const num = number || roomNumber;
    const room = await prisma.room.create({
      data: { number: num, floor: parseInt(floor) || 1, roomTypeId, hotelId: req.user.hotelId, status: status || 'AVAILABLE', notes },
      include: { roomType: true },
    });
    res.status(201).json(room);
  } catch (error) { next(error); }
};

// Update room
const updateRoom = async (req, res, next) => {
  try {
    const { number, roomNumber, floor, roomTypeId, status, cleanliness, notes } = req.body;
    const num = number || roomNumber;
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: { 
        ...(num && { number: num }), 
        ...(floor && { floor: parseInt(floor) }), 
        ...(roomTypeId && { roomTypeId }), 
        ...(status && { status }), 
        ...(notes !== undefined && { notes }) 
      },
      include: { roomType: true },
    });
    res.json(room);
  } catch (error) { next(error); }
};

// Delete room
const deleteRoom = async (req, res, next) => {
  try {
    await prisma.room.delete({ where: { id: req.params.id } });
    res.json({ message: 'Room deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { getRooms, getRoom, createRoom, updateRoom, deleteRoom };
