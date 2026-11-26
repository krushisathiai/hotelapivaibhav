const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getHotelId = async (user) => {
  if (user?.hotelId) return user.hotelId;
  const h = await prisma.hotel.findFirst();
  return h?.id || null;
};

// Generate unique booking number
const generateBookingNumber = async (hotelId) => {
  const year = new Date().getFullYear();
  const where = hotelId ? { hotelId } : {};
  const count = await prisma.booking.count({ where });
  return `HTL-${year}-${String(count + 1).padStart(6, '0')}`;
};

const getBookings = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const hotelId = await getHotelId(req.user);
    const where = hotelId ? { hotelId } : {};
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
    const { guestId, guestName, phone, email, roomId, checkInDate, checkOutDate, adults, children, ratePerNight, discount, source, specialRequests } = req.body;
    const hotelId = (await getHotelId(req.user)) || (await prisma.hotel.findFirst())?.id;

    if (!roomId) {
      return res.status(400).json({ message: 'Room selection is required' });
    }

    // Resolve or Auto-create Guest
    let finalGuestId = guestId;
    if (!finalGuestId && guestName) {
      const parts = guestName.trim().split(' ');
      const firstName = parts[0] || 'Guest';
      const lastName = parts.slice(1).join(' ') || '';
      const newGuest = await prisma.guest.create({
        data: {
          firstName,
          lastName,
          phone: phone || '+91 9876543210',
          email: email || `guest_${Date.now()}@luxestay.com`,
          hotelId,
        },
      });
      finalGuestId = newGuest.id;
    } else if (!finalGuestId) {
      let defaultGuest = await prisma.guest.findFirst({ where: hotelId ? { hotelId } : {} });
      if (!defaultGuest) {
        defaultGuest = await prisma.guest.create({
          data: {
            firstName: req.user?.name?.split(' ')[0] || 'Rahul',
            lastName: req.user?.name?.split(' ').slice(1).join(' ') || 'Sharma',
            phone: '+91 9876543210',
            email: req.user?.email || 'guest@luxestay.com',
            hotelId,
          },
        });
      }
      finalGuestId = defaultGuest.id;
    }

    // Check room availability (prevent double booking)
    const conflicting = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        OR: [
          { checkInDate: { lte: new Date(checkOutDate) }, checkOutDate: { gte: new Date(checkInDate) } },
        ],
      },
    });
    if (conflicting) {
      return res.status(409).json({ message: 'Room is already occupied or reserved for these dates.' });
    }

    // Resolve Rate per Night
    let finalRate = parseFloat(ratePerNight);
    if (!finalRate || isNaN(finalRate)) {
      const dbRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: { roomType: true },
      });
      finalRate = dbRoom?.roomType?.basePrice || 2500;
    }

    // Get hotel tax rate
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { taxRate: true } });
    const taxRate = hotel?.taxRate || 18;

    // Calculate totals
    const nights = Math.max(1, Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)));
    
    const subtotal = nights * finalRate;
    const discountAmount = parseFloat(discount) || 0;
    const taxAmount = ((subtotal - discountAmount) * taxRate) / 100;
    const totalAmount = subtotal - discountAmount + taxAmount;

    const bookingNumber = await generateBookingNumber(hotelId);

    const booking = await prisma.$transaction(async (tx) => {
      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          bookingNumber,
          guestId: finalGuestId,
          roomId,
          hotelId,
          checkInDate: new Date(checkInDate),
          checkOutDate: new Date(checkOutDate),
          adults: parseInt(adults) || 1,
          children: parseInt(children) || 0,
          ratePerNight: finalRate,
          discount: discountAmount,
          taxAmount,
          totalAmount,
          status: 'CHECKED_IN',
          source: source || 'DIRECT',
          specialRequests,
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
        data: { status: 'OCCUPIED' },
      });

      return newBooking;
    });

    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
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
