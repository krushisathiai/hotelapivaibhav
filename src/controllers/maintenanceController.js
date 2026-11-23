const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getTickets = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (req.user.hotelId) where.room = { hotelId: req.user.hotelId };
    if (status) where.status = status;
    const tickets = await prisma.maintenanceTicket.findMany({
      where, include: { room: { select: { number: true } }, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (error) { next(error); }
};

const createTicket = async (req, res, next) => {
  try {
    const { roomId, issue, description, priority, assignedToId } = req.body;
    const ticket = await prisma.maintenanceTicket.create({
      data: { roomId, issue, description, priority, assignedToId },
      include: { room: { select: { number: true } }, assignedTo: { select: { name: true } } },
    });
    if (roomId) await prisma.room.update({ where: { id: roomId }, data: { status: 'MAINTENANCE' } });
    res.status(201).json(ticket);
  } catch (error) { next(error); }
};

const updateTicket = async (req, res, next) => {
  try {
    const { status, assignedToId, description } = req.body;
    const ticket = await prisma.maintenanceTicket.update({
      where: { id: req.params.id },
      data: { status, assignedToId, description, ...(status === 'RESOLVED' || status === 'CLOSED' ? { completedAt: new Date() } : {}) },
    });
    if ((status === 'RESOLVED' || status === 'CLOSED') && ticket.roomId) {
      await prisma.room.update({ where: { id: ticket.roomId }, data: { status: 'AVAILABLE' } });
    }
    res.json(ticket);
  } catch (error) { next(error); }
};

const deleteTicket = async (req, res, next) => {
  try { await prisma.maintenanceTicket.delete({ where: { id: req.params.id } }); res.json({ message: 'Ticket deleted' }); } catch (error) { next(error); }
};

module.exports = { getTickets, createTicket, updateTicket, deleteTicket };
