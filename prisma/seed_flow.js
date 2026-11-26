const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌟 Seeding 4 Core Roles and Hotel Food Menu...');

  // 1. Get or Create Hotel
  let hotel = await prisma.hotel.findFirst();
  if (!hotel) {
    hotel = await prisma.hotel.create({
      data: {
        name: 'LuxeStay Palace & Resort',
        address: '77 Royal Avenue, Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        phone: '+91 22 8888 9999',
        email: 'info@luxestay.com',
        taxRate: 18,
        currency: 'INR',
      },
    });
    console.log('✅ Hotel created');
  }

  // 2. Upsert the 4 Essential Roles
  const password = await bcrypt.hash('admin123', 12);
  const usersToSeed = [
    { email: 'admin@luxestay.com', name: 'Admin (Master Manager)', role: 'HOTEL_ADMIN' },
    { email: 'waiter@luxestay.com', name: 'Ramesh (Waitstaff / Dining)', role: 'STAFF' },
    { email: 'billing@luxestay.com', name: 'Priya (Billing & Cashier)', role: 'ACCOUNTANT' },
    { email: 'guest@luxestay.com', name: 'Rahul Sharma (Guest / User)', role: 'RECEPTIONIST' },
  ];

  for (const u of usersToSeed) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          password,
          role: u.role,
          hotelId: hotel.id,
          isActive: true,
        },
      });
      console.log(`✅ Created User: ${u.email} [${u.role}]`);
    } else {
      await prisma.user.update({
        where: { email: u.email },
        data: { name: u.name, role: u.role, hotelId: hotel.id },
      });
      console.log(`✅ Updated User: ${u.email}`);
    }
  }

  // 3. Seed Menu Categories & Items
  const menuData = [
    {
      category: 'Breakfast Specials',
      items: [
        { name: 'Masala Dosa with Sambar & Chutney', price: 160, isVeg: true, description: 'Crispy golden crepe filled with spiced potato masala' },
        { name: 'Steamed Idli & Vada Combo', price: 140, isVeg: true, description: 'Soft steamed rice cakes & crispy lentil fritters with drumstick sambar' },
        { name: 'Stuffed Aloo Paratha with Curd', price: 150, isVeg: true, description: 'Layered whole wheat flatbread stuffed with spiced potatoes and white butter' },
        { name: 'Continental Club Sandwich', price: 220, isVeg: false, description: 'Triple-decker toasted sandwich with grilled chicken, cheese, egg, and fries' },
      ],
    },
    {
      category: 'Starters & Appetizers',
      items: [
        { name: 'Paneer Tikka Angara', price: 280, isVeg: true, description: 'Chargrilled cottage cheese marinated in smoked yoghurt spices' },
        { name: 'Crispy Chilli Corn & Pepper', price: 210, isVeg: true, description: 'Wok-tossed sweet corn kernels with scallions and garlic chilli sauce' },
        { name: 'Murgh Malai Tikka', price: 340, isVeg: false, description: 'Tender chicken skewers marinated with cream, cheese, and cardamom' },
        { name: 'Crispy Veg Spring Rolls', price: 190, isVeg: true, description: 'Golden pastry rolls stuffed with shredded vegetables with sweet chilli dip' },
      ],
    },
    {
      category: 'Main Course (Curries & Biryani)',
      items: [
        { name: 'Paneer Butter Masala', price: 320, isVeg: true, description: 'Rich tomato cashew makhani gravy with tender cottage cheese cubes' },
        { name: 'Dal Makhani 24-Hour Simmered', price: 260, isVeg: true, description: 'Black lentils slow cooked with churned butter and dairy cream' },
        { name: 'Hyderabadi Dum Chicken Biryani', price: 380, isVeg: false, description: 'Fragrant basmati rice dum cooked with spiced chicken and saffron aromatics' },
        { name: 'Kadhai Murgh Special', price: 360, isVeg: false, description: 'Chicken cooked in rustic cast-iron skillet with bell peppers and roasted spices' },
        { name: 'Butter Naan / Garlic Naan', price: 60, isVeg: true, description: 'Tandoor baked leavened bread brushed with farm butter and garlic' },
      ],
    },
    {
      category: 'Beverages & Drinks',
      items: [
        { name: 'Royal Kesariya Mango Lassi', price: 120, isVeg: true, description: 'Thick churned sweet yoghurt blended with Alphonso mango pulp' },
        { name: 'Masala Kadak Chai', price: 60, isVeg: true, description: 'Freshly brewed Assam tea with crushed ginger and green cardamom' },
        { name: 'South Indian Filter Coffee', price: 80, isVeg: true, description: 'Strong decoction frothed with hot creamy milk' },
        { name: 'Fresh Mint Lime Soda', price: 90, isVeg: true, description: 'Refreshing sparkling soda with fresh mint, lime, and rock salt' },
      ],
    },
    {
      category: 'Desserts',
      items: [
        { name: 'Hot Gulab Jamun with Ice Cream', price: 140, isVeg: true, description: 'Warm milk dumplings soaked in rose syrup served with vanilla scoop' },
        { name: 'Sizzling Chocolate Walnut Brownie', price: 220, isVeg: true, description: 'Fudgy warm brownie served on sizzling skillet with dark fudge sauce' },
      ],
    },
  ];

  for (const catData of menuData) {
    let cat = await prisma.menuCategory.findFirst({
      where: { name: catData.category, hotelId: hotel.id },
    });
    if (!cat) {
      cat = await prisma.menuCategory.create({
        data: { name: catData.category, hotelId: hotel.id },
      });
      console.log(`✅ Category created: ${catData.category}`);
    }

    for (const itemData of catData.items) {
      const exists = await prisma.menuItem.findFirst({
        where: { name: itemData.name, categoryId: cat.id },
      });
      if (!exists) {
        await prisma.menuItem.create({
          data: {
            name: itemData.name,
            description: itemData.description,
            price: itemData.price,
            isVeg: itemData.isVeg,
            isAvailable: true,
            categoryId: cat.id,
          },
        });
      }
    }
  }
  console.log('✅ Menu items seeded successfully!');

  // 4. Create an initial sample order for demonstration
  const sampleItem = await prisma.menuItem.findFirst();
  if (sampleItem) {
    const existingOrder = await prisma.restaurantOrder.findFirst();
    if (!existingOrder) {
      await prisma.restaurantOrder.create({
        data: {
          orderNumber: 'ORD-101',
          roomNumber: '102',
          guestName: 'Rahul Sharma (Guest)',
          notes: 'Extra spicy please, deliver immediately',
          status: 'PENDING',
          total: sampleItem.price * 2,
          hotelId: hotel.id,
          items: {
            create: [
              {
                itemId: sampleItem.id,
                quantity: 2,
                price: sampleItem.price,
              },
            ],
          },
        },
      });
      console.log('✅ Sample food order created for Room 102');
    }
  }

  console.log('🎉 Setup Complete for User, Admin, Waiter, and Billing!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
