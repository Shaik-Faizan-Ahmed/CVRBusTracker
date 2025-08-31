# 🚌 CVR Bus Tracker

A comprehensive real-time bus tracking system for CVR College of Engineering, featuring advanced analytics, smart notifications, and seamless user experience across mobile and web platforms.

## 🌟 Features

### 🔐 **Authentication & User Management**
- **Role-based Access Control**: Admin, Tracker, Student roles with specific permissions
- **JWT Authentication**: Secure token-based authentication with 7-day expiration
- **Profile Management**: User profile updates, password changes
- **Admin Controls**: User management, status control, comprehensive user listing

### 🗺️ **Advanced Route Management**
- **Enhanced Route Creation**: Detailed stops with addresses, landmarks, accessibility info
- **Smart Scheduling**: Multiple trip types (morning, evening, regular) with capacity management
- **Real-time Analytics**: Performance tracking, passenger analytics, efficiency metrics
- **Trip Management**: Complete trip lifecycle with passenger counting and delay tracking

### 📍 **Sophisticated Tracking System**
- **Real-time Location Updates**: GPS tracking with accuracy, speed, and heading
- **Smart ETA Calculations**: Multiple methods (simple, traffic-aware, historical)
- **Quality Scoring**: Data quality analysis with outlier detection
- **Live Map Integration**: Trail visualization with occupancy and delay information

### 🔔 **Intelligent Notification System**
- **Proximity-based Notifications**: Smart triggers for bus approaching/arriving
- **Capacity Warnings**: Automated alerts for high occupancy situations
- **Delay Notifications**: Real-time delay reporting with severity levels
- **Emergency Alerts**: Critical notification system for emergencies

### 📊 **Enterprise-grade Analytics**
- **Performance Metrics**: Route efficiency, on-time performance, delay analysis
- **Passenger Insights**: Flow analysis, peak hour identification, popular stops
- **Data Quality Monitoring**: GPS accuracy tracking and pattern analysis
- **Comprehensive Reporting**: Historical data analysis with trend identification

### 👨‍💼 **Professional Admin Tools**
- **Real-time Dashboard**: Route overview with alerts and recommendations
- **Performance Monitoring**: System health checks and analytics
- **User Management**: Complete admin interface for user control
- **Alert System**: Automated alerts for delays, capacity, and system issues

## 🏗️ **Technical Architecture**

### **Backend (Node.js + Express)**
- **Database**: MongoDB with Mongoose ODM
- **Real-time Communication**: Socket.io for live updates
- **Authentication**: JWT with bcrypt password hashing
- **Security**: Helmet, CORS, rate limiting, input validation
- **API Documentation**: Swagger/OpenAPI integration
- **Logging**: Winston for structured logging
- **Health Monitoring**: Comprehensive system health checks

### **Mobile App (React Native CLI)**
- **Cross-platform**: iOS and Android native builds
- **Real-time Updates**: Socket.io integration
- **Maps Integration**: Live tracking with route visualization
- **Push Notifications**: Firebase Cloud Messaging
- **Offline Support**: Local storage and sync capabilities

### **Admin Panel (React.js)**
- **Dashboard**: Real-time analytics and monitoring
- **Route Management**: Advanced route creation and editing
- **User Management**: Comprehensive admin interface
- **Reporting**: Analytics and performance reports

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- MongoDB (local or Atlas)
- Git

### **Backend Setup**
```bash
# Clone repository
git clone https://github.com/Shaik-Faizan-Ahmed/CVRBusTracker.git
cd CVRBusTracker/backend

# Install dependencies (already installed)
# npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Seed database with test data
npm run seed

# Start development server
npm run dev
```

### **API Endpoints**
- **Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/health
- **Authentication**: `/api/auth/*`
- **Routes**: `/api/buses/*`
- **Tracking**: `/api/tracking/*`

## 🎯 **Test Credentials**

### **Admin User**
- **Roll Number**: `ADMIN001`
- **Password**: `admin123`
- **Permissions**: Full system access

### **Bus Trackers**
- **Roll Numbers**: `TRACK001`, `TRACK002`
- **Password**: `tracker123`
- **Permissions**: Location tracking, trip management

### **Students**
- **Roll Numbers**: `21B91A0501`, `21B91A0502`
- **Password**: `student123`
- **Permissions**: View routes, receive notifications

## 📱 **Sample Routes**

### **Kukatpally Route (KUK001)**
**Stops**: Kukatpally Metro → KPHB Colony → Moosapet → Balanagar → CVR College
- **Features**: Accessibility info, wait times, passenger analytics
- **Schedule**: Morning (7:30 AM) and Evening (5:00 PM) trips

### **Miyapur Route (MIY002)**  
**Stops**: Miyapur Metro → Lingampally → Chandanagar → CVR College
- **Type**: Express route with limited stops
- **Schedule**: Morning (7:45 AM) and Evening (5:15 PM) trips

## 🔧 **Development Status**

### **✅ Completed (Phase 1)**
- [x] **Complete Backend Foundation** with authentication
- [x] **Advanced Route Management** with analytics
- [x] **Real-time Tracking System** with quality scoring
- [x] **Smart Notification Engine** with proximity triggers
- [x] **Admin Dashboard APIs** with alerts
- [x] **Production-ready Infrastructure** with monitoring

### **🚧 In Progress (Phase 2)**
- [ ] **React Native Mobile App** development
- [ ] **Push Notification Integration** (Firebase setup)
- [ ] **Offline Sync Capabilities**
- [ ] **Advanced Map Features**

### **📋 Planned (Phase 3)**
- [ ] **Admin Web Panel** (React.js)
- [ ] **Advanced Analytics Dashboard**
- [ ] **Reporting System**
- [ ] **Performance Optimization**

## 🏆 **Key Achievements**

### **🔐 Enterprise Security**
- Multi-layer security with JWT, rate limiting, input validation
- Role-based access control with granular permissions
- Production-ready error handling and logging

### **📊 Advanced Analytics**
- Real-time performance monitoring and route optimization
- Passenger flow analysis and peak hour identification
- Data quality scoring with outlier detection

### **🔔 Intelligent Notifications**
- Proximity-based smart notifications with cooldown management
- Emergency alert system with priority-based delivery
- Capacity warnings and schedule change notifications

### **⚡ Production Ready**
- Comprehensive health monitoring and system checks
- Graceful shutdown handling and error recovery
- API documentation with Swagger integration

## 🌐 **API Documentation**

Complete API documentation is available at `/api/docs` when running the server.

### **Key Endpoints**
- `POST /api/auth/login` - User authentication
- `GET /api/buses/routes` - Get all routes with analytics
- `POST /api/tracking/location` - Update bus location (tracker only)
- `GET /api/tracking/eta/:routeId/:stopId` - Calculate ETA
- `GET /api/buses/dashboard` - Admin dashboard data

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📧 **Contact**

**Developer**: Shaik Faizan Ahmed
**Email**: [Your Email]
**GitHub**: [@Shaik-Faizan-Ahmed](https://github.com/Shaik-Faizan-Ahmed)

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- CVR College of Engineering for the project opportunity
- MongoDB Atlas for database hosting
- Socket.io for real-time communication
- All contributors and testers

---

**Built with ❤️ for CVR College students and faculty**