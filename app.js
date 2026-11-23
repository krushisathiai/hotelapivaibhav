const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./src/config');
const { errorHandler } = require('./src/middleware/errorHandler');
const { authenticate } = require('./src/middleware/auth');
const { authorize, ADMIN_ROLES, MANAGEMENT_ROLES, DESK_ROLES, FINANCE_ROLES, ALL_ROLES } = require('./src/middleware/rbac');

const app = express();

// Middleware
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many attempts. Please try again later.' } });

// ==================== ROUTES ====================

// Auth
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authLimiter, authRoutes);

// Dashboard
const { getDashboard } = require('./src/controllers/dashboardController');
app.get('/api/dashboard', authenticate, getDashboard);
app.get('/api/dashboard/stats', authenticate, getDashboard);

// Rooms
const roomCtrl = require('./src/controllers/roomController');
app.get('/api/rooms', authenticate, roomCtrl.getRooms);
app.get('/api/rooms/:id', authenticate, roomCtrl.getRoom);
app.post('/api/rooms', authenticate, authorize(...MANAGEMENT_ROLES), roomCtrl.createRoom);
app.put('/api/rooms/:id', authenticate, authorize(...MANAGEMENT_ROLES), roomCtrl.updateRoom);
app.patch('/api/rooms/:id/status', authenticate, authorize(...MANAGEMENT_ROLES), roomCtrl.updateRoom);
app.delete('/api/rooms/:id', authenticate, authorize(...ADMIN_ROLES), roomCtrl.deleteRoom);

// Room Types
const roomTypeCtrl = require('./src/controllers/roomTypeController');
app.get('/api/room-types', authenticate, roomTypeCtrl.getRoomTypes);
app.post('/api/room-types', authenticate, authorize(...MANAGEMENT_ROLES), roomTypeCtrl.createRoomType);
app.put('/api/room-types/:id', authenticate, authorize(...MANAGEMENT_ROLES), roomTypeCtrl.updateRoomType);
app.delete('/api/room-types/:id', authenticate, authorize(...ADMIN_ROLES), roomTypeCtrl.deleteRoomType);

// Guests
const guestCtrl = require('./src/controllers/guestController');
app.get('/api/guests', authenticate, guestCtrl.getGuests);
app.get('/api/guests/:id', authenticate, guestCtrl.getGuest);
app.post('/api/guests', authenticate, authorize(...DESK_ROLES), guestCtrl.createGuest);
app.put('/api/guests/:id', authenticate, authorize(...DESK_ROLES), guestCtrl.updateGuest);
app.delete('/api/guests/:id', authenticate, authorize(...ADMIN_ROLES), guestCtrl.deleteGuest);

// Bookings
const bookingCtrl = require('./src/controllers/bookingController');
app.get('/api/bookings', authenticate, bookingCtrl.getBookings);
app.get('/api/bookings/:id', authenticate, bookingCtrl.getBooking);
app.post('/api/bookings', authenticate, authorize(...DESK_ROLES), bookingCtrl.createBooking);
app.put('/api/bookings/:id/status', authenticate, authorize(...DESK_ROLES), bookingCtrl.updateBookingStatus);
app.post('/api/bookings/:id/check-in', authenticate, authorize(...DESK_ROLES), (req, res, next) => { req.body.status = 'CHECKED_IN'; bookingCtrl.updateBookingStatus(req, res, next); });
app.post('/api/bookings/:id/check-out', authenticate, authorize(...DESK_ROLES), (req, res, next) => { req.body.status = 'CHECKED_OUT'; bookingCtrl.updateBookingStatus(req, res, next); });
app.post('/api/bookings/:id/cancel', authenticate, authorize(...DESK_ROLES), (req, res, next) => { req.body.status = 'CANCELLED'; bookingCtrl.updateBookingStatus(req, res, next); });
app.delete('/api/bookings/:id', authenticate, authorize(...ADMIN_ROLES), bookingCtrl.deleteBooking);

// Billing & Payments
const billingCtrl = require('./src/controllers/billingController');
app.get('/api/payments', authenticate, authorize(...FINANCE_ROLES, 'RECEPTIONIST'), billingCtrl.getPayments);
app.post('/api/payments', authenticate, authorize(...FINANCE_ROLES, 'RECEPTIONIST'), billingCtrl.createPayment);
app.get('/api/invoices', authenticate, authorize(...FINANCE_ROLES, 'RECEPTIONIST'), billingCtrl.getInvoices);
app.get('/api/billing/invoices', authenticate, authorize(...FINANCE_ROLES, 'RECEPTIONIST'), billingCtrl.getInvoices);
app.get('/api/invoices/:id', authenticate, billingCtrl.getInvoice);
app.post('/api/invoices', authenticate, authorize(...FINANCE_ROLES, 'RECEPTIONIST'), billingCtrl.generateInvoice);
app.post('/api/billing/invoices', authenticate, authorize(...FINANCE_ROLES, 'RECEPTIONIST'), billingCtrl.generateInvoice);

// Services
const serviceCtrl = require('./src/controllers/serviceController');
app.get('/api/services', authenticate, serviceCtrl.getServices);
app.post('/api/services', authenticate, authorize(...MANAGEMENT_ROLES), serviceCtrl.createService);
app.put('/api/services/:id', authenticate, authorize(...MANAGEMENT_ROLES), serviceCtrl.updateService);
app.post('/api/service-charges', authenticate, authorize(...DESK_ROLES), serviceCtrl.addServiceCharge);
app.get('/api/service-charges/:bookingId', authenticate, serviceCtrl.getServiceCharges);

// Housekeeping
const housekeepingCtrl = require('./src/controllers/housekeepingController');
app.get('/api/housekeeping', authenticate, housekeepingCtrl.getTasks);
app.post('/api/housekeeping', authenticate, authorize(...DESK_ROLES, 'HOUSEKEEPING'), housekeepingCtrl.createTask);
app.put('/api/housekeeping/:id', authenticate, authorize(...DESK_ROLES, 'HOUSEKEEPING'), housekeepingCtrl.updateTask);
app.delete('/api/housekeeping/:id', authenticate, authorize(...MANAGEMENT_ROLES), housekeepingCtrl.deleteTask);

// Maintenance
const maintenanceCtrl = require('./src/controllers/maintenanceController');
app.get('/api/maintenance', authenticate, maintenanceCtrl.getTickets);
app.post('/api/maintenance', authenticate, authorize(...DESK_ROLES), maintenanceCtrl.createTicket);
app.put('/api/maintenance/:id', authenticate, authorize(...DESK_ROLES), maintenanceCtrl.updateTicket);
app.delete('/api/maintenance/:id', authenticate, authorize(...MANAGEMENT_ROLES), maintenanceCtrl.deleteTicket);

// Staff
const staffCtrl = require('./src/controllers/staffController');
app.get('/api/staff', authenticate, authorize(...MANAGEMENT_ROLES), staffCtrl.getStaff);
app.post('/api/staff', authenticate, authorize(...ADMIN_ROLES), staffCtrl.createStaff);
app.put('/api/staff/:id', authenticate, authorize(...ADMIN_ROLES), staffCtrl.updateStaff);
app.delete('/api/staff/:id', authenticate, authorize(...ADMIN_ROLES), staffCtrl.deleteStaff);

// Expenses
const expenseCtrl = require('./src/controllers/expenseController');
app.get('/api/expenses', authenticate, authorize(...FINANCE_ROLES), expenseCtrl.getExpenses);
app.post('/api/expenses', authenticate, authorize(...FINANCE_ROLES), expenseCtrl.createExpense);
app.put('/api/expenses/:id', authenticate, authorize(...FINANCE_ROLES), expenseCtrl.updateExpense);
app.delete('/api/expenses/:id', authenticate, authorize(...ADMIN_ROLES), expenseCtrl.deleteExpense);

// Inventory
const inventoryCtrl = require('./src/controllers/inventoryController');
app.get('/api/inventory', authenticate, inventoryCtrl.getItems);
app.post('/api/inventory', authenticate, authorize(...MANAGEMENT_ROLES), inventoryCtrl.createItem);
app.put('/api/inventory/:id', authenticate, authorize(...MANAGEMENT_ROLES), inventoryCtrl.updateItem);
app.post('/api/inventory/transaction', authenticate, authorize(...MANAGEMENT_ROLES), inventoryCtrl.stockTransaction);
app.delete('/api/inventory/:id', authenticate, authorize(...ADMIN_ROLES), inventoryCtrl.deleteItem);
app.get('/api/suppliers', authenticate, inventoryCtrl.getSuppliers);
app.post('/api/suppliers', authenticate, authorize(...MANAGEMENT_ROLES), inventoryCtrl.createSupplier);

// Notifications
const notifCtrl = require('./src/controllers/notificationController');
app.get('/api/notifications', authenticate, notifCtrl.getNotifications);
app.put('/api/notifications/:id/read', authenticate, notifCtrl.markAsRead);
app.put('/api/notifications/read-all', authenticate, notifCtrl.markAllRead);

// Settings
const settingsCtrl = require('./src/controllers/settingsController');
app.get('/api/settings', authenticate, settingsCtrl.getHotel);
app.put('/api/settings', authenticate, authorize(...ADMIN_ROLES), settingsCtrl.updateHotel);
app.get('/api/settings/hotel', authenticate, settingsCtrl.getHotel);
app.put('/api/settings/hotel', authenticate, authorize(...ADMIN_ROLES), settingsCtrl.updateHotel);
app.get('/api/settings/users', authenticate, authorize(...ADMIN_ROLES), settingsCtrl.getUsers);
app.put('/api/settings/users/:id', authenticate, authorize(...ADMIN_ROLES), settingsCtrl.updateUser);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
