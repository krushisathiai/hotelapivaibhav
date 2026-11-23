const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPayment = async (req, res, next) => {
  try {
    const { bookingId, amount, method, reference, notes } = req.body;

    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          bookingId,
          guestId: (await tx.booking.findUnique({ where: { id: bookingId }, select: { guestId: true } })).guestId,
          amount: parseFloat(amount),
          method: method || 'CASH',
          reference, notes,
          collectedById: req.user.id,
        },
      });

      // Update booking paid amount
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      await tx.booking.update({
        where: { id: bookingId },
        data: { paidAmount: booking.paidAmount + parseFloat(amount) },
      });

      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'PAYMENT_CREATED', entity: 'Payment', entityId: newPayment.id },
      });

      return newPayment;
    });

    res.status(201).json(payment);
  } catch (error) { next(error); }
};

const getPayments = async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { booking: { hotelId: req.user.hotelId } },
      include: {
        booking: { select: { bookingNumber: true } },
        guest: { select: { firstName: true, lastName: true } },
        collectedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (error) { next(error); }
};

// Generate Invoice
const generateInvoice = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        serviceCharges: { include: { service: true } },
      },
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(6, '0')}`;

    const nights = Math.ceil((new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / (86400000));
    const roomCharges = nights * booking.ratePerNight;
    const serviceTotal = booking.serviceCharges.reduce((s, sc) => s + sc.amount, 0);
    const subtotal = roomCharges + serviceTotal;
    const taxAmount = booking.taxAmount;
    const totalAmount = subtotal - booking.discount + taxAmount;

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber, bookingId,
          subtotal, taxAmount, discount: booking.discount, totalAmount,
          status: booking.paidAmount >= totalAmount ? 'PAID' : booking.paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
          items: {
            create: [
              { description: `Room ${booking.room.number} (${booking.room.roomType.name}) - ${nights} nights`, quantity: nights, unitPrice: booking.ratePerNight, amount: roomCharges },
              ...booking.serviceCharges.map(sc => ({ description: sc.service.name, quantity: sc.quantity, unitPrice: sc.amount / sc.quantity, amount: sc.amount })),
            ],
          },
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'INVOICE_GENERATED', entity: 'Invoice', entityId: inv.id },
      });

      return inv;
    });

    res.status(201).json(invoice);
  } catch (error) { next(error); }
};

const getInvoices = async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { booking: { hotelId: req.user.hotelId } },
      include: {
        booking: {
          select: {
            bookingNumber: true,
            guest: { select: { firstName: true, lastName: true } },
            room: { select: { number: true } },
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error) { next(error); }
};

const getInvoice = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            payments: true,
          },
        },
        items: true,
      },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (error) { next(error); }
};

module.exports = { createPayment, getPayments, generateInvoice, getInvoices, getInvoice };
