const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate unique booking number
const generateBookingNumber = async (hotelId) => {
  const year = new Date().getFullYear();
  const count = await prisma.booking.count({ where: { hotelId } });
  return `HTL-${year}-${String(count + 1).padStart(6, '0')}`;
};

const getBookings = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { hotelId: req.user.hotelId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { bookingNumber: { contains: search, mode: 'insensitive' } },
        { guest: { firstName: { contains: search, mode: 'insensitive' } } },
        { guest: { lastName: { contains: search, mode: 'insensitive' } } },
        { room: { number: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where, skip, take: parseInt(limit),
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true, email: true } },
          room: { select: { number: true, roomType: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where }),
    ]);
    res.json({ bookings, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) { next(error); }
};

const getBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        payments: true,
        invoices: { include: { items: true } },
        serviceCharges: { include: { service: true } },
        createdBy: { select: { name: true } },
      },
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) { next(error); }
};

const createBooking = async (req, res, next) => {
  try {
    const { guestId, roomId, checkInDate, checkOutDate, adults, children, ratePerNight, discount, source, specialRequests } = req.body;
    const hotelId = req.user.hotelId;

    // Check room availability (prevent double booking)
    const conflicting = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        OR: [
          { checkInDate: { lte: new Date(checkOutDate) }, checkOutDate: { gte: new Date(checkInDate) } },
        ],
      },
    });
    if (conflicting) {
      return res.status(409).json({ message: 'Room is not available for the selected dates. There is a conflicting reservation.' });
    }

    // Get hotel tax rate
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { taxRate: true } });
    const taxRate = hotel?.taxRate || 18;

    // Calculate totals
    const nights = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return res.status(400).json({ message: 'Check-out date must be after check-in date' });
    
    const subtotal = nights * parseFloat(ratePerNight);
    const discountAmount = parseFloat(discount) || 0;
    const taxAmount = ((subtotal - discountAmount) * taxRate) / 100;
    const totalAmount = subtotal - discountAmount + taxAmount;

    const bookingNumber = await generateBookingNumber(hotelId);

    const booking = await prisma.$transaction(async (tx) => {
      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          bookingNumber, guestId, roomId, hotelId,
          checkInDate: new Date(checkInDate), checkOutDate: new Date(checkOutDate),
          adults: parseInt(adults) || 1, children: parseInt(children) || 0,
          ratePerNight: parseFloat(ratePerNight), discount: discountAmount,
          taxAmount, totalAmount,
          source: source || 'WALK_IN', specialRequests,
          createdById: req.user.id,
        },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          room: { select: { number: true, roomType: { select: { name: true } } } },
        },
      });

      // Update room status
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'RESERVED' },
      });

      // Audit log
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'BOOKING_CREATED', entity: 'Booking', entityId: newBooking.id },
      });

      return newBooking;
    });

    res.status(201).json(booking);
  } catch (error) { next(error); }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: req.params.id },
        data: {
          status,
          ...(status === 'CHECKED_IN' && { actualCheckIn: new Date() }),
          ...(status === 'CHECKED_OUT' && { actualCheckOut: new Date() }),
        },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          room: { select: { number: true } },
        },
      });

      // Update room status based on booking status
      if (status === 'CHECKED_IN') {
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'OCCUPIED' } });
      } else if (status === 'CHECKED_OUT') {
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
      } else if (status === 'CANCELLED' || status === 'NO_SHOW') {
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } });
      }

      await tx.auditLog.create({
        data: { userId: req.user.id, action: `BOOKING_${status}`, entity: 'Booking', entityId: req.params.id },
      });

      return updatedBooking;
    });

    res.json(result);
  } catch (error) { next(error); }
};

const deleteBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    await prisma.$transaction(async (tx) => {
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } });
      await tx.booking.delete({ where: { id: req.params.id } });
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'BOOKING_DELETED', entity: 'Booking', entityId: req.params.id },
      });
    });

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { getBookings, getBooking, createBooking, updateBookingStatus, deleteBooking };
