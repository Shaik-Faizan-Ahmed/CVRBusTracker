const mongoose = require('mongoose');
const User = require('../models/User');
const Route = require('../models/Route');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cvr-bus-tracker');
    console.log('✅ Connected to MongoDB for seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data (optional - comment out for production)
    // await User.deleteMany({});
    // await Route.deleteMany({});
    // console.log('🧹 Cleared existing data');

    // Create admin user
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const admin = new User({
        rollNumber: 'ADMIN001',
        password: 'admin123', // Will be hashed automatically
        name: 'CVR Bus Tracker Admin',
        role: 'admin'
      });
      await admin.save();
      console.log('👤 Admin user created: ADMIN001 / admin123');
    } else {
      console.log('👤 Admin user already exists');
    }

    // Create sample tracker users
    const trackerExists = await User.findOne({ role: 'tracker' });
    if (!trackerExists) {
      const tracker1 = new User({
        rollNumber: 'TRACK001',
        password: 'tracker123',
        name: 'Bus Driver Ramesh',
        role: 'tracker'
      });

      const tracker2 = new User({
        rollNumber: 'TRACK002', 
        password: 'tracker123',
        name: 'Bus Driver Suresh',
        role: 'tracker'
      });

      await tracker1.save();
      await tracker2.save();
      console.log('🚌 Tracker users created: TRACK001, TRACK002 / tracker123');
    } else {
      console.log('🚌 Tracker users already exist');
    }

    // Create sample student users
    const studentExists = await User.findOne({ role: 'student' });
    if (!studentExists) {
      const students = [
        {
          rollNumber: '21B91A0501',
          password: 'student123',
          name: 'Test Student 1',
          role: 'student'
        },
        {
          rollNumber: '21B91A0502',
          password: 'student123', 
          name: 'Test Student 2',
          role: 'student'
        }
      ];

      for (const studentData of students) {
        const student = new User(studentData);
        await student.save();
      }
      console.log('👥 Sample students created: 21B91A0501, 21B91A0502 / student123');
    } else {
      console.log('👥 Student users already exist');
    }

    // Create sample bus routes
    const routeExists = await Route.findOne({});
    if (!routeExists) {
      // Get tracker IDs
      const tracker1 = await User.findOne({ rollNumber: 'TRACK001' });
      const tracker2 = await User.findOne({ rollNumber: 'TRACK002' });

      // Sample Route 1: Kukatpally to CVR College
      const route1 = new Route({
        name: 'Kukatpally Route',
        description: 'From Kukatpally Metro to CVR College via KPHB, Moosapet, Balanagar',
        routeCode: 'KUK001',
        stops: [
          {
            name: 'Kukatpally Metro Station',
            latitude: 17.4849,
            longitude: 78.4138,
            order: 1,
            estimatedTime: 0,
            address: 'Kukatpally Metro Station, Hyderabad',
            landmark: 'Metro Station',
            averageWaitTime: 3,
            accessibility: {
              wheelchairAccessible: true,
              covered: true
            }
          },
          {
            name: 'KPHB Colony',
            latitude: 17.4924,
            longitude: 78.3918,
            order: 2,
            estimatedTime: 8,
            address: 'KPHB Colony, Hyderabad',
            landmark: 'KPHB Main Road',
            averageWaitTime: 2
          },
          {
            name: 'Moosapet',
            latitude: 17.5061,
            longitude: 78.3957,
            order: 3,
            estimatedTime: 15,
            address: 'Moosapet, Hyderabad',
            landmark: 'Moosapet Junction'
          },
          {
            name: 'Balanagar',
            latitude: 17.5167,
            longitude: 78.3833,
            order: 4,
            estimatedTime: 22,
            address: 'Balanagar, Hyderabad',
            landmark: 'Balanagar Cross Roads'
          },
          {
            name: 'CVR College Main Gate',
            latitude: 17.5239,
            longitude: 78.3844,
            order: 5,
            estimatedTime: 30,
            address: 'CVR College of Engineering, Vastunagar',
            landmark: 'College Main Gate',
            accessibility: {
              wheelchairAccessible: true,
              covered: false
            }
          }
        ],
        tracker: tracker1._id,
        schedule: [
          {
            day: 'monday',
            trips: [
              {
                departureTime: '07:30',
                type: 'morning',
                capacity: 50,
                estimatedDuration: 35
              },
              {
                departureTime: '17:00',
                type: 'evening',
                capacity: 50,
                estimatedDuration: 40
              }
            ]
          },
          {
            day: 'tuesday',
            trips: [
              {
                departureTime: '07:30',
                type: 'morning',
                capacity: 50,
                estimatedDuration: 35
              },
              {
                departureTime: '17:00',
                type: 'evening',
                capacity: 50,
                estimatedDuration: 40
              }
            ]
          }
        ],
        settings: {
          notificationRadius: 500,
          etaCalculationMethod: 'historical',
          maxCapacity: 50,
          allowOverbooking: false,
          emergencyContact: '9876543210',
          routeType: 'regular',
          operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          specialInstructions: 'Please be at the stop 5 minutes before departure time'
        },
        analytics: {
          totalTrips: 45,
          totalPassengers: 1250,
          averageRating: 4.2,
          peakHours: {
            morning: { start: '07:00', end: '09:00' },
            evening: { start: '17:00', end: '19:00' }
          }
        }
      });

      // Sample Route 2: Miyapur to CVR College
      const route2 = new Route({
        name: 'Miyapur Route',
        description: 'From Miyapur Metro to CVR College via Lingampally, Chandanagar',
        routeCode: 'MIY002',
        stops: [
          {
            name: 'Miyapur Metro Station',
            latitude: 17.4967,
            longitude: 78.3583,
            order: 1,
            estimatedTime: 0,
            address: 'Miyapur Metro Station, Hyderabad',
            landmark: 'Metro Station',
            averageWaitTime: 4,
            accessibility: {
              wheelchairAccessible: true,
              covered: true
            }
          },
          {
            name: 'Lingampally',
            latitude: 17.5158,
            longitude: 78.3664,
            order: 2,
            estimatedTime: 10,
            address: 'Lingampally, Hyderabad',
            landmark: 'Lingampally Junction'
          },
          {
            name: 'Chandanagar',
            latitude: 17.5203,
            longitude: 78.3742,
            order: 3,
            estimatedTime: 18,
            address: 'Chandanagar, Hyderabad',
            landmark: 'Chandanagar Main Road'
          },
          {
            name: 'CVR College Main Gate',
            latitude: 17.5239,
            longitude: 78.3844,
            order: 4,
            estimatedTime: 25,
            address: 'CVR College of Engineering, Vastunagar',
            landmark: 'College Main Gate',
            accessibility: {
              wheelchairAccessible: true,
              covered: false
            }
          }
        ],
        tracker: tracker2._id,
        schedule: [
          {
            day: 'monday',
            trips: [
              {
                departureTime: '07:45',
                type: 'morning',
                capacity: 45,
                estimatedDuration: 30
              },
              {
                departureTime: '17:15',
                type: 'evening',
                capacity: 45,
                estimatedDuration: 35
              }
            ]
          }
        ],
        settings: {
          notificationRadius: 500,
          etaCalculationMethod: 'traffic-aware',
          maxCapacity: 45,
          allowOverbooking: false,
          emergencyContact: '9876543211',
          routeType: 'express',
          operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          specialInstructions: 'Express route with limited stops'
        },
        analytics: {
          totalTrips: 38,
          totalPassengers: 980,
          averageRating: 4.5,
          peakHours: {
            morning: { start: '07:30', end: '09:00' },
            evening: { start: '17:00', end: '18:30' }
          }
        }
      });

      await route1.save();
      await route2.save();
      console.log('🗺️ Sample routes created: Kukatpally & Miyapur routes');
    } else {
      console.log('🗺️ Routes already exist');
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('Admin: ADMIN001 / admin123');
    console.log('Trackers: TRACK001, TRACK002 / tracker123');
    console.log('Students: 21B91A0501, 21B91A0502 / student123');
    console.log('\n🚀 Ready to test with these credentials!');

  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

const main = async () => {
  await connectDB();
  await seedData();
  process.exit(0);
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { seedData };