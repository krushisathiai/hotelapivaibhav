const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboard = async (req, res, next) => {
  try {
    const hotelId = req.user.hotelId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Room stats
    const rooms = await prisma.room.groupBy({
      by: ['status'],
      where: { hotelId },
      _count: true,
    });

    const roomStats = {
      total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0, cleaning: 0,
    };
    rooms.forEach(r => {
      roomStats.total += r._count;
      const key = r.status.toLowerCase();
      if (roomStats[key] !== undefined) roomStats[key] = r._count;
    });

    // Today's check-ins
    const todayCheckIns = await prisma.booking.count({
      where: {
        hotelId,
        checkInDate: { gte: today, lt: tomorrow },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
    });

    // Today's check-outs
    const todayCheckOuts = await prisma.booking.count({
      where: {
        hotelId,
        checkOutDate: { gte: today, lt: tomorrow },
        status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
      },
    });

    // Current guests (checked-in)
    const currentGuests = await prisma.booking.count({
      where: { hotelId, status: 'CHECKED_IN' },
    });

    // Today's revenue
    const todayPayments = await prisma.payment.aggregate({
      where: {
        booking: { hotelId },
        createdAt: { gte: today, lt: tomorrow },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });

    // Monthly revenue
    const monthlyPayments = await prisma.payment.aggregate({
      where: {
        booking: { hotelId },
        createdAt: { gte: monthStart, lte: monthEnd },
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });

    // Pending payments
    const pendingPayments = await prisma.booking.aggregate({
      where: {
        hotelId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const pendingAmount = (pendingPayments._sum.totalAmount || 0) - (pendingPayments._sum.paidAmount || 0);

    // Occupancy rate
    const occupancyRate = roomStats.total > 0
      ? Math.round((roomStats.occupied / roomStats.total) * 100)
      : 0;

    // Recent bookings
    const recentBookings = await prisma.booking.findMany({
      where: { hotelId },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { number: true, roomType: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Today's arrivals
    const todayArrivals = await prisma.booking.findMany({
      where: {
        hotelId,
        checkInDate: { gte: today, lt: tomorrow },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      include: {
        guest: { select: { firstName: true, lastName: true, phone: true } },
        room: { select: { number: true, roomType: { select: { name: true } } } },
      },
      orderBy: { checkInDate: 'asc' },
    });

    // Today's departures
    const todayDepartures = await prisma.booking.findMany({
      where: {
        hotelId,
        checkOutDate: { gte: today, lt: tomorrow },
        status: 'CHECKED_IN',
      },
      include: {
        guest: { select: { firstName: true, lastName: true, phone: true } },
        room: { select: { number: true, roomType: { select: { name: true } } } },
      },
      orderBy: { checkOutDate: 'asc' },
    });

    // Revenue chart data (last 7 days)
    const revenueChartData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayRevenue = await prisma.payment.aggregate({
        where: {
          booking: { hotelId },
          createdAt: { gte: day, lt: nextDay },
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      });

      revenueChartData.push({
        date: day.toISOString().split('T')[0],
        revenue: dayRevenue._sum.amount || 0,
      });
    }

    // Monthly occupancy data
    const occupancyChartData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEndDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });

      const monthBookings = await prisma.booking.count({
        where: {
          hotelId,
          checkInDate: { lte: monthEndDate },
          checkOutDate: { gte: monthDate },
          status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        },
      });

      const daysInMonth = monthEndDate.getDate();
      const maxOccupancy = roomStats.total * daysInMonth;
      const occupancy = maxOccupancy > 0 ? Math.round((monthBookings / roomStats.total) * 100) : 0;

      occupancyChartData.push({ month: monthName, occupancy: Math.min(occupancy, 100) });
    }

    res.json({
      roomStats,
      todayCheckIns,
      todayCheckOuts,
      currentGuests,
      todayRevenue: todayPayments._sum.amount || 0,
      monthlyRevenue: monthlyPayments._sum.amount || 0,
      pendingPayments: pendingAmount,
      occupancyRate,
      recentBookings,
      todayArrivals,
      todayDepartures,
      revenueChartData,
      occupancyChartData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
