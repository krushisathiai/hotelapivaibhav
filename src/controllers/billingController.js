const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPayment = async (req, res, next) => {
  try {
    const { bookingId, amount, method, reference, notes } = req.body;

    const payment = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error('Booking not found');

      const newPayment = await tx.payment.create({
        data: {
          bookingId,
          guestId: booking.guestId,
          amount: parseFloat(amount),
          method: method || 'CASH',
          reference,
          notes,
          collectedById: req.user.id,
        },
      });

      // Update booking paid amount
      await tx.booking.update({
        where: { id: bookingId },
        data: { paidAmount: booking.paidAmount + parseFloat(amount) },
      });

      return newPayment;
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const hotelId = req.user?.hotelId;
    const where = hotelId ? { booking: { hotelId } } : {};

    const payments = await prisma.payment.findMany({
      where,
      include: {
        booking: { select: { bookingNumber: true } },
        guest: { select: { firstName: true, lastName: true } },
        collectedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
};

// Checkout preview: combines Room Stay + Food Orders + Services
const getCheckoutPreview = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        serviceCharges: { include: { service: true } },
        payments: true,
      },
    });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Fetch all restaurant food orders for this booking or room
    const foodOrders = await prisma.restaurantOrder.findMany({
      where: {
        OR: [
          { bookingId: booking.id },
          { roomNumber: String(booking.room.number) },
        ],
        status: { not: 'CANCELLED' },
      },
      include: {
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(1, Math.ceil((checkOut - checkIn) / 86400000));
    const roomCharges = nights * booking.ratePerNight;

    const foodCharges = foodOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const serviceChargesTotal = booking.serviceCharges.reduce((sum, sc) => sum + (sc.amount || 0), 0);

    const subtotal = roomCharges + foodCharges + serviceChargesTotal;
    const taxRate = 18; // 18% GST
    const taxAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + taxAmount;
    const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = Math.max(0, totalAmount - totalPaid);

    res.json({
      booking,
      roomCharges,
      nights,
      foodOrders,
      foodCharges,
      serviceChargesTotal,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      totalPaid,
      balanceDue,
    });
  } catch (error) {
    next(error);
  }
};

// Complete Checkout & Generate Unified Invoice (Room + Food)
const processCheckoutPayment = async (req, res, next) => {
  try {
    const { bookingId, paymentMethod, amountPaid } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        serviceCharges: { include: { service: true } },
      },
    });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Fetch food orders
    const foodOrders = await prisma.restaurantOrder.findMany({
      where: {
        OR: [
          { bookingId: booking.id },
          { roomNumber: String(booking.room.number) },
        ],
        status: { not: 'CANCELLED' },
      },
      include: {
        items: { include: { item: true } },
      },
    });

    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(1, Math.ceil((checkOut - checkIn) / 86400000));
    const roomCharges = nights * booking.ratePerNight;
    const foodCharges = foodOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const serviceTotal = booking.serviceCharges.reduce((s, sc) => s + sc.amount, 0);

    const subtotal = roomCharges + foodCharges + serviceTotal;
    const taxAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + taxAmount;

    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Itemized invoice lines
    const invoiceItems = [
      {
        description: `Room ${booking.room.number} (${booking.room.roomType.name}) - ${nights} Night(s)`,
        quantity: nights,
        unitPrice: booking.ratePerNight,
        amount: roomCharges,
      },
    ];

    // Add each food item ordered
    for (const order of foodOrders) {
      for (const orderItem of order.items) {
        invoiceItems.push({
          description: `Food: ${orderItem.item?.name || 'Meal'} (Order #${order.orderNumber || order.id.slice(0, 6)})`,
          quantity: orderItem.quantity,
          unitPrice: orderItem.price,
          amount: orderItem.price * orderItem.quantity,
        });
      }
    }

    // Add services
    for (const sc of booking.serviceCharges) {
      invoiceItems.push({
        description: `Service: ${sc.service?.name || 'Add-on'}`,
        quantity: sc.quantity,
        unitPrice: sc.amount / sc.quantity,
        amount: sc.amount,
      });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      // Create Invoice
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          bookingId: booking.id,
          subtotal,
          taxAmount,
          discount: booking.discount || 0,
          totalAmount,
          status: 'PAID',
          items: {
            create: invoiceItems,
          },
        },
        include: { items: true },
      });

      // Record Payment
      const paid = parseFloat(amountPaid) || totalAmount;
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          guestId: booking.guestId,
          amount: paid,
          method: paymentMethod || 'CASH',
          status: 'COMPLETED',
          collectedById: req.user.id,
          notes: 'Settled at checkout',
        },
      });

      // Update Booking to CHECKED_OUT
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CHECKED_OUT',
          paidAmount: booking.paidAmount + paid,
          actualCheckOut: new Date(),
        },
      });

      // Mark Room as CLEANING
      await tx.room.update({
        where: { id: booking.roomId },
        data: { status: 'CLEANING' },
      });

      // Mark Food orders as PAID
      if (foodOrders.length > 0) {
        await tx.restaurantOrder.updateMany({
          where: {
            id: { in: foodOrders.map((o) => o.id) },
          },
          data: { status: 'PAID' },
        });
      }

      return inv;
    });

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

const getInvoices = async (req, res, next) => {
  try {
    const hotelId = req.user?.hotelId;
    const where = hotelId ? { booking: { hotelId } } : {};

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        booking: {
          select: {
            bookingNumber: true,
            guest: { select: { firstName: true, lastName: true, phone: true } },
            room: { select: { number: true } },
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
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
  } catch (error) {
    next(error);
  }
};

// Legacy generateInvoice for backward compatibility
const generateInvoice = processCheckoutPayment;

module.exports = {
  createPayment,
  getPayments,
  getCheckoutPreview,
  processCheckoutPayment,
  generateInvoice,
  getInvoices,
  getInvoice,
};
