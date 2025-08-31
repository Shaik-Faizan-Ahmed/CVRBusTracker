# API Testing Guide

## Quick Start Testing

### 1. Start the Server
```bash
cd backend
npm run dev
```

### 2. Seed Database with Test Data
```bash
npm run seed
```

### 3. Test Endpoints with curl

#### Health Check
```bash
curl http://localhost:3000/api/health
```

#### Login as Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"ADMIN001","password":"admin123"}'
```

#### Login as Student
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"21B91A0501","password":"student123"}'
```

#### Get Routes (requires token)
```bash
curl -X GET http://localhost:3000/api/buses/routes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### Update Location as Tracker
```bash
curl -X POST http://localhost:3000/api/tracking/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TRACKER_JWT_TOKEN" \
  -d '{
    "routeId":"ROUTE_ID_FROM_ROUTES_API",
    "latitude":17.4849,
    "longitude":78.4138,
    "accuracy":10,
    "speed":25
  }'
```

## Test Scenarios

### Authentication Flow
1. ✅ Register new user (admin only)
2. ✅ Login with valid credentials
3. ✅ Login with invalid credentials (should fail)
4. ✅ Access protected route without token (should fail)
5. ✅ Access protected route with valid token
6. ✅ Update profile information
7. ✅ Change password

### Route Management
1. ✅ Get all routes
2. ✅ Get single route details  
3. ✅ Create new route (admin only)
4. ✅ Update existing route (admin only)
5. ✅ Deactivate route (admin only)

### Real-time Tracking
1. ✅ Update bus location (tracker only)
2. ✅ Get current bus location
3. ✅ Set student waiting stop
4. ✅ Calculate ETA for stop
5. ✅ Report delay
6. ✅ Get tracking history

### Socket.io Testing
1. ✅ Connect with valid JWT token
2. ✅ Join route room
3. ✅ Receive location updates
4. ✅ Send location updates (tracker only)
5. ✅ Receive delay notifications

## Expected Test Data
After running `npm run seed`:

### Users Created:
- **Admin:** ADMIN001 / admin123
- **Trackers:** TRACK001, TRACK002 / tracker123  
- **Students:** 21B91A0501, 21B91A0502 / student123

### Routes Created:
- **Route 1:** Kukatpally to CVR College (5 stops)
- **Route 2:** Miyapur to CVR College (4 stops)

## Testing Tools

### Recommended Tools:
1. **Postman** - For API testing with collections
2. **WebSocket King** - For Socket.io testing
3. **MongoDB Compass** - For database inspection

### Browser Testing:
- Visit `http://localhost:3000/api/docs` for Swagger documentation
- Visit `http://localhost:3000/api/health` for health status
- Visit `http://localhost:3000/api` for API info

## Common Test Issues

### Database Connection
- Ensure MongoDB is running locally OR
- Configure MongoDB Atlas connection string

### Token Expiration
- JWT tokens expire in 7 days
- Re-login if getting "token expired" errors

### CORS Issues
- Update FRONTEND_URL in .env if testing from browser

### Rate Limiting
- If you hit rate limits, wait 15 minutes or restart server