# 🚀 CVR Bus Tracker - Quick Start Guide

## Development Setup

### 1. Prerequisites
- Node.js 18+ installed
- MongoDB running locally OR MongoDB Atlas account
- Git installed

### 2. Backend Installation
```bash
# Navigate to backend directory
cd backend

# Dependencies are already installed
# If needed: npm install

# Copy and configure environment file
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Seed database with test data
npm run seed
```

### 3. Start Backend Server
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

### 4. Test the API
```bash
# Health check
curl http://localhost:3000/api/health

# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"ADMIN001","password":"admin123"}'
```

### 5. View Documentation
- **API Documentation:** http://localhost:3000/api/docs
- **Health Status:** http://localhost:3000/api/health
- **API Info:** http://localhost:3000/api

## 🎯 Test Credentials

### Admin User
- **Roll Number:** ADMIN001
- **Password:** admin123
- **Role:** admin

### Bus Trackers
- **Roll Number:** TRACK001 / **Password:** tracker123
- **Roll Number:** TRACK002 / **Password:** tracker123
- **Role:** tracker

### Students
- **Roll Number:** 21B91A0501 / **Password:** student123
- **Roll Number:** 21B91A0502 / **Password:** student123
- **Role:** student

## 🚌 Sample Bus Routes Available

### Kukatpally Route (Route ID: route_kukatpally)
**5 stops from Kukatpally Metro to CVR College:**
1. Kukatpally Metro Station
2. KPHB Colony
3. Moosapet
4. Balanagar
5. CVR College Main Gate

### Miyapur Route (Route ID: route_miyapur)  
**4 stops from Miyapur Metro to CVR College:**
1. Miyapur Metro Station
2. Lingampally
3. Chandanagar
4. CVR College Main Gate

## 📱 API Endpoints Ready

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile

### Bus Routes
- `GET /api/buses/routes` - Get all routes
- `POST /api/buses/routes` - Create new route (admin only)
- `PUT /api/buses/routes/:id` - Update route (admin only)
- `DELETE /api/buses/routes/:id` - Delete route (admin only)

### Real-time Tracking
- `POST /api/tracking/location` - Update bus location (tracker only)
- `GET /api/tracking/location/:routeId` - Get current bus location
- `POST /api/tracking/student-stop` - Set student's stop
- `GET /api/tracking/eta/:routeId/:stopId` - Get ETA for specific stop

### System
- `GET /api/health` - Comprehensive system health
- `GET /api/health/quick` - Quick health check
- `GET /api/docs` - API documentation

## ⚡ Socket.io Events Available

### For Students
- `join-route` - Join route for real-time updates
- `location-update` - Receive bus location updates
- `eta-update` - Receive ETA updates
- `bus-arrival` - Bus arrival notifications

### For Trackers
- `update-location` - Send location updates
- `report-delay` - Report delays

## 🔧 Development Features

### Comprehensive Logging
- All API requests logged with Winston
- Different log levels (info, warn, error)
- Request duration tracking
- IP and user agent logging

### Security Features
- Rate limiting (different limits for different endpoints)
- JWT authentication with role-based access
- Input validation with Joi schemas
- CORS protection
- Helmet security headers

### Production Ready
- Graceful shutdown handling
- Health monitoring
- Error handling with proper status codes
- Environment validation on startup
- API documentation with Swagger

## 🚀 Ready for Next Phase!

**Backend is fully functional and ready for:**
- Mobile app integration
- Real-time location testing
- Push notification setup
- Admin panel development

**Phase 1, Session 1: ✅ COMPLETE**
**Ready for Phase 1, Session 2: Route Management System Enhancement**

---

### Quick Commands Reference
```bash
# Start development server
npm run dev

# Seed database
npm run seed

# Test health
curl http://localhost:3000/api/health

# View API docs
open http://localhost:3000/api/docs
```

The complete backend foundation is ready for mobile app integration and further development!