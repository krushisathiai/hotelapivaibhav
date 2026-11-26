const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get full menu categorized
const getMenu = async (req, res, next) => {
  try {
    const hotelId = req.user?.hotelId;
    const where = hotelId ? { hotelId } : {};

    const categories = await prisma.menuCategory.findMany({
      where,
      include: {
        items: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
};

// Create Menu Item (Admin)
const createMenuItem = async (req, res, next) => {
  try {
    const { name, description, price, categoryId, isVeg, isAvailable, image } = req.body;
    if (!name || !price || !categoryId) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        description: description || '',
        price: parseFloat(price),
        categoryId,
        isVeg: isVeg !== undefined ? isVeg : true,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        image: image || null,
      },
      include: { category: true },
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

// Update Menu Item
const updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, isVeg, isAvailable, image, categoryId } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseFloat(price);
    if (isVeg !== undefined) data.isVeg = isVeg;
    if (isAvailable !== undefined) data.isAvailable = isAvailable;
    if (image !== undefined) data.image = image;
    if (categoryId !== undefined) data.categoryId = categoryId;

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
      include: { category: true },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Delete Menu Item
const deleteMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.menuItem.delete({ where: { id } });
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Create Food Order (Guest / Waiter / Admin)
const createOrder = async (req, res, next) => {
  try {
    const { roomNumber, guestName, bookingId, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // Fetch items from DB to verify price and availability
    const itemIds = items.map((i) => i.itemId);
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
    });

    const itemMap = new Map(dbItems.map((i) => [i.id, i]));

    let orderTotal = 0;
    const orderItemsData = [];

    for (const orderItem of items) {
      const dbItem = itemMap.get(orderItem.itemId);
      if (!dbItem) continue;
      const quantity = Math.max(1, parseInt(orderItem.quantity) || 1);
      const price = dbItem.price;
      orderTotal += price * quantity;

      orderItemsData.push({
        itemId: dbItem.id,
        quantity,
        price,
      });
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const hotelId = req.user?.hotelId || null;

    const newOrder = await prisma.restaurantOrder.create({
      data: {
        orderNumber,
        roomNumber: roomNumber ? String(roomNumber) : 'Walk-in Table',
        guestName: guestName || req.user?.name || 'Guest',
        bookingId: bookingId || null,
        notes: notes || '',
        roomCharge: Boolean(roomNumber || bookingId),
        status: 'PENDING',
        total: orderTotal,
        hotelId,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
};

// Get All Orders (for Waiter Desk & Admin)
const getOrders = async (req, res, next) => {
  try {
    const { status, roomNumber } = req.query;
    const where = {};

    if (req.user?.hotelId) {
      where.hotelId = req.user.hotelId;
    }
    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }
    if (roomNumber) {
      where.roomNumber = roomNumber;
    }

    const orders = await prisma.restaurantOrder.findMany({
      where,
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// Update Order Status (Waiter & Admin)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const updated = await prisma.restaurantOrder.update({
      where: { id },
      data: { status: status.toUpperCase() },
      include: {
        items: {
          include: { item: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Get Orders for a specific booking / room (for User & Billing)
const getRoomOrders = async (req, res, next) => {
  try {
    const { roomNumber, bookingId } = req.query;
    const where = {};

    if (bookingId) where.bookingId = bookingId;
    if (roomNumber) where.roomNumber = String(roomNumber);

    const orders = await prisma.restaurantOrder.findMany({
      where,
      include: {
        items: {
          include: { item: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createOrder,
  getOrders,
  updateOrderStatus,
  getRoomOrders,
};
