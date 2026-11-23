const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Hotel
  const hotel = await prisma.hotel.create({
    data: {
      name: 'LuxeStay Grand Hotel',
      address: '123 Premium Boulevard',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zipCode: '400001',
      phone: '+91 22 1234 5678',
      email: 'info@luxestay.com',
      website: 'https://luxestay.com',
      taxId: 'GSTIN1234567890',
      taxRate: 18,
      currency: 'INR',
      checkInTime: '14:00',
      checkOutTime: '11:00',
    },
  });
  console.log('✅ Hotel created');

  // Create Users
  const password = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@luxestay.com', password, role: 'HOTEL_ADMIN', hotelId: hotel.id },
  });
  const managerUser = await prisma.user.create({
    data: { name: 'Manager Singh', email: 'manager@luxestay.com', password, role: 'MANAGER', hotelId: hotel.id },
  });
  const receptionistUser = await prisma.user.create({
    data: { name: 'Priya Receptionist', email: 'reception@luxestay.com', password, role: 'RECEPTIONIST', hotelId: hotel.id },
  });
  await prisma.user.create({
    data: { name: 'Housekeeping Staff', email: 'hk@luxestay.com', password, role: 'HOUSEKEEPING', hotelId: hotel.id },
  });
  await prisma.user.create({
    data: { name: 'Accountant Sharma', email: 'accounts@luxestay.com', password, role: 'ACCOUNTANT', hotelId: hotel.id },
  });
  console.log('✅ Users created');

  // Create Room Types
  const single = await prisma.roomType.create({
    data: { name: 'Standard Single', description: 'Comfortable single room with modern amenities', basePrice: 2500, capacity: 1, beds: 1, amenities: ['WiFi', 'AC', 'TV', 'Mini Bar'], hotelId: hotel.id },
  });
  const double = await prisma.roomType.create({
    data: { name: 'Deluxe Double', description: 'Spacious double room with city view', basePrice: 4500, capacity: 2, beds: 1, amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'City View', 'Room Service'], hotelId: hotel.id },
  });
  const suite = await prisma.roomType.create({
    data: { name: 'Premium Suite', description: 'Luxurious suite with separate living area', basePrice: 8500, capacity: 3, beds: 2, amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'City View', 'Room Service', 'Jacuzzi', 'Balcony'], hotelId: hotel.id },
  });
  const family = await prisma.roomType.create({
    data: { name: 'Family Room', description: 'Perfect for families with children', basePrice: 6000, capacity: 4, beds: 2, amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Extra Bed Available'], hotelId: hotel.id },
  });
  console.log('✅ Room types created');

  // Create Rooms
  const roomData = [
    { number: '101', floor: 1, roomTypeId: single.id }, { number: '102', floor: 1, roomTypeId: single.id },
    { number: '103', floor: 1, roomTypeId: double.id }, { number: '104', floor: 1, roomTypeId: double.id },
    { number: '201', floor: 2, roomTypeId: double.id }, { number: '202', floor: 2, roomTypeId: double.id },
    { number: '203', floor: 2, roomTypeId: suite.id }, { number: '204', floor: 2, roomTypeId: family.id },
    { number: '301', floor: 3, roomTypeId: suite.id }, { number: '302', floor: 3, roomTypeId: suite.id },
    { number: '303', floor: 3, roomTypeId: family.id }, { number: '304', floor: 3, roomTypeId: double.id },
    { number: '401', floor: 4, roomTypeId: suite.id }, { number: '402', floor: 4, roomTypeId: family.id },
    { number: '403', floor: 4, roomTypeId: single.id }, { number: '404', floor: 4, roomTypeId: double.id },
  ];

  const rooms = [];
  for (const rd of roomData) {
    const room = await prisma.room.create({ data: { ...rd, hotelId: hotel.id } });
    rooms.push(room);
  }
  console.log(`✅ ${rooms.length} rooms created`);

  // Create Guests
  const guestData = [
    { firstName: 'Rahul', lastName: 'Sharma', email: 'rahul@example.com', phone: '+91 9876543210', city: 'Delhi', country: 'India', idType: 'Aadhar', idNumber: '1234-5678-9012' },
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah@example.com', phone: '+1 555-1234', city: 'New York', country: 'USA', idType: 'Passport', idNumber: 'US12345678' },
    { firstName: 'Amit', lastName: 'Patel', email: 'amit@example.com', phone: '+91 8765432109', city: 'Ahmedabad', country: 'India', idType: 'Aadhar', idNumber: '9876-5432-1098' },
    { firstName: 'Emma', lastName: 'Wilson', email: 'emma@example.com', phone: '+44 7911123456', city: 'London', country: 'UK', idType: 'Passport', idNumber: 'GB98765432' },
    { firstName: 'Priya', lastName: 'Gupta', email: 'priya@example.com', phone: '+91 7654321098', city: 'Mumbai', country: 'India', idType: 'DrivingLicense', idNumber: 'MH1234567890' },
  ];

  const guests = [];
  for (const gd of guestData) {
    const guest = await prisma.guest.create({ data: { ...gd, hotelId: hotel.id } });
    guests.push(guest);
  }
  console.log(`✅ ${guests.length} guests created`);

  // Create Bookings
  const today = new Date();
  const bookings = [];

  // Active booking (checked in)
  const b1 = await prisma.booking.create({
    data: {
      bookingNumber: 'HTL-2026-000001', guestId: guests[0].id, roomId: rooms[2].id, hotelId: hotel.id,
      checkInDate: new Date(today.getTime() - 2 * 86400000), checkOutDate: new Date(today.getTime() + 2 * 86400000),
      actualCheckIn: new Date(today.getTime() - 2 * 86400000),
      adults: 2, ratePerNight: 4500, taxAmount: 3240, totalAmount: 21240, paidAmount: 21240,
      status: 'CHECKED_IN', source: 'WEBSITE', createdById: receptionistUser.id,
    },
  });
  await prisma.room.update({ where: { id: rooms[2].id }, data: { status: 'OCCUPIED' } });
  bookings.push(b1);

  // Confirmed booking (arriving today)
  const b2 = await prisma.booking.create({
    data: {
      bookingNumber: 'HTL-2026-000002', guestId: guests[1].id, roomId: rooms[6].id, hotelId: hotel.id,
      checkInDate: today, checkOutDate: new Date(today.getTime() + 3 * 86400000),
      adults: 1, ratePerNight: 8500, taxAmount: 4590, totalAmount: 30090, paidAmount: 0,
      status: 'CONFIRMED', source: 'OTA', createdById: receptionistUser.id,
    },
  });
  await prisma.room.update({ where: { id: rooms[6].id }, data: { status: 'RESERVED' } });
  bookings.push(b2);

  // Another checked-in booking
  const b3 = await prisma.booking.create({
    data: {
      bookingNumber: 'HTL-2026-000003', guestId: guests[2].id, roomId: rooms[7].id, hotelId: hotel.id,
      checkInDate: new Date(today.getTime() - 1 * 86400000), checkOutDate: today,
      actualCheckIn: new Date(today.getTime() - 1 * 86400000),
      adults: 2, children: 1, ratePerNight: 6000, taxAmount: 1080, totalAmount: 7080, paidAmount: 7080,
      status: 'CHECKED_IN', source: 'WALK_IN', createdById: receptionistUser.id,
    },
  });
  await prisma.room.update({ where: { id: rooms[7].id }, data: { status: 'OCCUPIED' } });
  bookings.push(b3);

  // Past completed booking
  const b4 = await prisma.booking.create({
    data: {
      bookingNumber: 'HTL-2026-000004', guestId: guests[3].id, roomId: rooms[0].id, hotelId: hotel.id,
      checkInDate: new Date(today.getTime() - 7 * 86400000), checkOutDate: new Date(today.getTime() - 4 * 86400000),
      actualCheckIn: new Date(today.getTime() - 7 * 86400000), actualCheckOut: new Date(today.getTime() - 4 * 86400000),
      adults: 1, ratePerNight: 2500, taxAmount: 1350, totalAmount: 8850, paidAmount: 8850,
      status: 'CHECKED_OUT', source: 'PHONE', createdById: receptionistUser.id,
    },
  });
  bookings.push(b4);

  console.log(`✅ ${bookings.length} bookings created`);

  // Payments
  await prisma.payment.create({
    data: { bookingId: b1.id, guestId: guests[0].id, amount: 21240, method: 'CARD', status: 'COMPLETED', collectedById: receptionistUser.id },
  });
  await prisma.payment.create({
    data: { bookingId: b3.id, guestId: guests[2].id, amount: 7080, method: 'CASH', status: 'COMPLETED', collectedById: receptionistUser.id },
  });
  await prisma.payment.create({
    data: { bookingId: b4.id, guestId: guests[3].id, amount: 8850, method: 'UPI', status: 'COMPLETED', collectedById: receptionistUser.id },
  });
  console.log('✅ Payments created');

  // Services
  const serviceData = [
    { name: 'Laundry Service', price: 500, description: 'Same-day laundry service' },
    { name: 'Airport Pickup', price: 2000, description: 'Airport to hotel transfer' },
    { name: 'Spa Treatment', price: 3000, description: 'Full body spa treatment' },
    { name: 'Extra Bed', price: 800, description: 'Additional bed in room' },
    { name: 'Room Service', price: 300, description: 'In-room dining delivery' },
    { name: 'Parking', price: 200, description: 'Daily car parking' },
    { name: 'Breakfast Buffet', price: 600, description: 'Full breakfast buffet' },
  ];
  for (const sd of serviceData) {
    await prisma.service.create({ data: { ...sd, hotelId: hotel.id } });
  }
  console.log('✅ Services created');

  // Staff
  const staffData = [
    { name: 'Rajesh Kumar', department: 'Reception', position: 'Senior Receptionist', salary: 25000, email: 'rajesh@luxestay.com', phone: '+91 9876500001' },
    { name: 'Sunita Devi', department: 'Housekeeping', position: 'Supervisor', salary: 22000, email: 'sunita@luxestay.com', phone: '+91 9876500002' },
    { name: 'Mohan Lal', department: 'Maintenance', position: 'Technician', salary: 20000, email: 'mohan@luxestay.com', phone: '+91 9876500003' },
    { name: 'Anita Roy', department: 'Restaurant', position: 'Chef', salary: 35000, email: 'anita@luxestay.com', phone: '+91 9876500004' },
    { name: 'Vikram Singh', department: 'Accounts', position: 'Junior Accountant', salary: 28000, email: 'vikram@luxestay.com', phone: '+91 9876500005' },
  ];
  for (const sd of staffData) {
    await prisma.staff.create({ data: { ...sd, hotelId: hotel.id } });
  }
  console.log('✅ Staff created');

  // Inventory
  const inventoryData = [
    { name: 'Bed Sheets', category: 'Linens', quantity: 50, unit: 'pcs', minStock: 20 },
    { name: 'Towels', category: 'Linens', quantity: 100, unit: 'pcs', minStock: 30 },
    { name: 'Soap Bars', category: 'Toiletries', quantity: 200, unit: 'pcs', minStock: 50 },
    { name: 'Shampoo Sachets', category: 'Toiletries', quantity: 300, unit: 'pcs', minStock: 100 },
    { name: 'Cleaning Liquid', category: 'Cleaning', quantity: 15, unit: 'liters', minStock: 5 },
    { name: 'Light Bulbs', category: 'Maintenance', quantity: 25, unit: 'pcs', minStock: 10 },
  ];
  for (const id of inventoryData) {
    await prisma.inventoryItem.create({ data: { ...id, hotelId: hotel.id } });
  }
  console.log('✅ Inventory created');

  // Notifications
  await prisma.notification.createMany({
    data: [
      { userId: adminUser.id, title: 'Welcome to LuxeStay!', message: 'Your hotel management system is ready to use.', type: 'success' },
      { userId: adminUser.id, title: 'New Booking', message: 'Sarah Johnson has a confirmed reservation for Premium Suite.', type: 'info', link: '/bookings' },
      { userId: adminUser.id, title: 'Payment Pending', message: 'Booking HTL-2026-000002 has pending payment of ₹30,090.', type: 'warning', link: '/billing' },
    ],
  });
  console.log('✅ Notifications created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('  Admin:        admin@luxestay.com / admin123');
  console.log('  Manager:      manager@luxestay.com / admin123');
  console.log('  Receptionist: reception@luxestay.com / admin123');
  console.log('  Housekeeping: hk@luxestay.com / admin123');
  console.log('  Accountant:   accounts@luxestay.com / admin123');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
