const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');

const prisma = new PrismaClient();

// Register
const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, hotelName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create hotel first if hotelName provided, or link to existing default hotel
    let hotelId = null;
    if (hotelName) {
      const hotel = await prisma.hotel.create({
        data: { name: hotelName, email: email },
      });
      hotelId = hotel.id;
    } else {
      const defaultHotel = await prisma.hotel.findFirst();
      hotelId = defaultHotel?.id || null;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: hotelId ? 'HOTEL_ADMIN' : 'STAFF',
        hotelId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hotelId: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        entity: 'User',
        entityId: user.id,
      },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, hotelId: user.hotelId },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (error) {
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
      },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, hotelId: user.hotelId },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hotelId: user.hotelId,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        hotelId: true,
        avatar: true,
        hotel: {
          select: { id: true, name: true, logo: true, currency: true },
        },
      },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Update profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone, avatar },
      select: {
        id: true, name: true, email: true, phone: true, role: true, hotelId: true, avatar: true,
      },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };
