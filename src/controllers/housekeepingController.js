const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getTasks = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { room: { hotelId: req.user.hotelId } };
    if (status) where.status = status;
    const tasks = await prisma.housekeepingTask.findMany({
      where,
      include: {
        room: { select: { number: true, floor: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks);
  } catch (error) { next(error); }
};

const createTask = async (req, res, next) => {
  try {
    const { roomId, assignedToId, task, priority, notes } = req.body;
    const newTask = await prisma.housekeepingTask.create({
      data: { roomId, assignedToId, task, priority, notes },
      include: { room: { select: { number: true } }, assignedTo: { select: { name: true } } },
    });
    res.status(201).json(newTask);
  } catch (error) { next(error); }
};

const updateTask = async (req, res, next) => {
  try {
    const { status, assignedToId, notes } = req.body;
    const task = await prisma.housekeepingTask.update({
      where: { id: req.params.id },
      data: { status, assignedToId, notes, ...(status === 'COMPLETED' && { completedAt: new Date() }) },
      include: { room: { select: { number: true } }, assignedTo: { select: { name: true } } },
    });

    // If completed, update room status to available
    if (status === 'COMPLETED') {
      await prisma.room.update({ where: { id: task.roomId }, data: { status: 'AVAILABLE' } });
    }

    res.json(task);
  } catch (error) { next(error); }
};

const deleteTask = async (req, res, next) => {
  try {
    await prisma.housekeepingTask.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (error) { next(error); }
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
