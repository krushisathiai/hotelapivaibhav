const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getGuests = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { hotelId: req.user.hotelId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where, skip, take: parseInt(limit),
        include: { _count: { select: { bookings: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.guest.count({ where }),
    ]);
    res.json({ guests, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) { next(error); }
};

const getGuest = async (req, res, next) => {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id },
      include: {
        bookings: {
          include: {
            room: { select: { number: true, roomType: { select: { name: true } } } },
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!guest) return res.status(404).json({ message: 'Guest not found' });

    // Calculate stats
    const totalStays = guest.bookings.filter(b => b.status === 'CHECKED_OUT').length;
    const totalSpending = guest.bookings.reduce((sum, b) => sum + b.paidAmount, 0);

    res.json({ ...guest, totalStays, totalSpending });
  } catch (error) { next(error); }
};

const createGuest = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, address, city, country, idType, idNumber, dateOfBirth, notes } = req.body;
    const guest = await prisma.guest.create({
      data: { firstName, lastName, email, phone, address, city, country, idType, idNumber, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, notes, hotelId: req.user.hotelId },
    });
    res.status(201).json(guest);
  } catch (error) { next(error); }
};

const updateGuest = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, address, city, country, idType, idNumber, dateOfBirth, notes } = req.body;
    const guest = await prisma.guest.update({
      where: { id: req.params.id },
      data: { firstName, lastName, email, phone, address, city, country, idType, idNumber, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined, notes },
    });
    res.json(guest);
  } catch (error) { next(error); }
};

const deleteGuest = async (req, res, next) => {
  try {
    await prisma.guest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Guest deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { getGuests, getGuest, createGuest, updateGuest, deleteGuest };
