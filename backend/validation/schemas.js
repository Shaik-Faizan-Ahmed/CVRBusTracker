const Joi = require('joi');

// Enhanced validation schemas for Session 2

// User validation schemas
const userSchemas = {
  register: Joi.object({
    rollNumber: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .min(6)
      .max(15)
      .required()
      .messages({
        'string.pattern.base': 'Roll number must contain only uppercase letters and numbers',
        'string.min': 'Roll number must be at least 6 characters',
        'string.max': 'Roll number cannot exceed 15 characters'
      }),
    password: Joi.string()
      .min(6)
      .max(50)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters',
        'string.max': 'Password cannot exceed 50 characters'
      }),
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    role: Joi.string()
      .valid('student', 'tracker', 'admin')
      .default('student')
  }),

  login: Joi.object({
    rollNumber: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid roll number format'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  }),

  updateProfile: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional(),
    fcmToken: Joi.string()
      .optional(),
    notificationPreferences: Joi.object({
      busApproaching: Joi.boolean().default(true),
      busArriving: Joi.boolean().default(true),
      delays: Joi.boolean().default(true),
      tripStart: Joi.boolean().default(true),
      emergencies: Joi.boolean().default(true),
      scheduleChanges: Joi.boolean().default(true)
    }).optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required(),
    newPassword: Joi.string()
      .min(6)
      .max(50)
      .required()
      .messages({
        'string.min': 'New password must be at least 6 characters'
      })
  })
};

// Enhanced Route validation schemas for Session 2
const routeSchemas = {
  createRoute: Joi.object({
    name: Joi.string()
      .trim()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.min': 'Route name must be at least 3 characters'
      }),
    description: Joi.string()
      .trim()
      .max(500)
      .optional(),
    routeCode: Joi.string()
      .trim()
      .min(3)
      .max(10)
      .optional(),
    stops: Joi.array()
      .items(
        Joi.object({
          name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required(),
          latitude: Joi.number()
            .min(-90)
            .max(90)
            .required()
            .messages({
              'number.min': 'Latitude must be between -90 and 90',
              'number.max': 'Latitude must be between -90 and 90'
            }),
          longitude: Joi.number()
            .min(-180)
            .max(180)
            .required()
            .messages({
              'number.min': 'Longitude must be between -180 and 180',
              'number.max': 'Longitude must be between -180 and 180'
            }),
          order: Joi.number()
            .integer()
            .min(1)
            .optional(),
          estimatedTime: Joi.number()
            .min(0)
            .max(300)
            .optional(),
          address: Joi.string()
            .trim()
            .max(200)
            .optional(),
          landmark: Joi.string()
            .trim()
            .max(100)
            .optional(),
          averageWaitTime: Joi.number()
            .min(0)
            .max(30)
            .optional(),
          accessibility: Joi.object({
            wheelchairAccessible: Joi.boolean().default(false),
            covered: Joi.boolean().default(false)
          }).optional()
        })
      )
      .min(2)
      .required()
      .messages({
        'array.min': 'Route must have at least 2 stops'
      }),
    tracker: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid tracker ID format'
      }),
    schedule: Joi.array()
      .items(
        Joi.object({
          day: Joi.string()
            .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
            .required(),
          trips: Joi.array()
            .items(
              Joi.object({
                departureTime: Joi.string()
                  .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                  .required()
                  .messages({
                    'string.pattern.base': 'Time must be in HH:MM format (24-hour)'
                  }),
                type: Joi.string()
                  .valid('morning', 'evening', 'regular')
                  .default('regular'),
                capacity: Joi.number()
                  .integer()
                  .min(10)
                  .max(100)
                  .default(50),
                estimatedDuration: Joi.number()
                  .min(5)
                  .max(120)
                  .default(30)
              })
            )
            .min(1)
            .required()
        })
      )
      .optional(),
    settings: Joi.object({
      notificationRadius: Joi.number()
        .min(100)
        .max(2000)
        .default(500),
      etaCalculationMethod: Joi.string()
        .valid('simple', 'traffic-aware', 'historical')
        .default('historical'),
      maxCapacity: Joi.number()
        .integer()
        .min(10)
        .max(100)
        .default(50),
      allowOverbooking: Joi.boolean()
        .default(false),
      emergencyContact: Joi.string()
        .trim()
        .max(15)
        .optional(),
      routeType: Joi.string()
        .valid('regular', 'express', 'circular')
        .default('regular'),
      operatingDays: Joi.array()
        .items(
          Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        )
        .default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
      specialInstructions: Joi.string()
        .trim()
        .max(500)
        .optional()
    }).optional(),
    operatingDays: Joi.array()
      .items(
        Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
      )
      .optional(),
    routeType: Joi.string()
      .valid('regular', 'express', 'circular')
      .optional(),
    specialInstructions: Joi.string()
      .trim()
      .max(500)
      .optional()
  }),

  updateRoute: Joi.object({
    name: Joi.string()
      .trim()
      .min(3)
      .max(100)
      .optional(),
    description: Joi.string()
      .trim()
      .max(500)
      .optional(),
    routeCode: Joi.string()
      .trim()
      .min(3)
      .max(10)
      .optional(),
    stops: Joi.array()
      .items(
        Joi.object({
          id: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .optional(),
          _id: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .optional(),
          name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required(),
          latitude: Joi.number()
            .min(-90)
            .max(90)
            .required(),
          longitude: Joi.number()
            .min(-180)
            .max(180)
            .required(),
          order: Joi.number()
            .integer()
            .min(1)
            .optional(),
          estimatedTime: Joi.number()
            .min(0)
            .max(300)
            .optional(),
          address: Joi.string()
            .trim()
            .max(200)
            .optional(),
          landmark: Joi.string()
            .trim()
            .max(100)
            .optional(),
          averageWaitTime: Joi.number()
            .min(0)
            .max(30)
            .optional(),
          accessibility: Joi.object({
            wheelchairAccessible: Joi.boolean().optional(),
            covered: Joi.boolean().optional()
          }).optional()
        })
      )
      .min(2)
      .optional(),
    tracker: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null)
      .optional(),
    isActive: Joi.boolean()
      .optional(),
    schedule: Joi.array()
      .items(
        Joi.object({
          day: Joi.string()
            .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
            .required(),
          trips: Joi.array()
            .items(
              Joi.object({
                departureTime: Joi.string()
                  .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                  .required(),
                type: Joi.string()
                  .valid('morning', 'evening', 'regular')
                  .default('regular'),
                capacity: Joi.number()
                  .integer()
                  .min(10)
                  .max(100)
                  .default(50),
                estimatedDuration: Joi.number()
                  .min(5)
                  .max(120)
                  .default(30)
              })
            )
            .min(1)
            .required()
        })
      )
      .optional(),
    settings: Joi.object({
      notificationRadius: Joi.number()
        .min(100)
        .max(2000)
        .optional(),
      etaCalculationMethod: Joi.string()
        .valid('simple', 'traffic-aware', 'historical')
        .optional(),
      maxCapacity: Joi.number()
        .integer()
        .min(10)
        .max(100)
        .optional(),
      allowOverbooking: Joi.boolean()
        .optional(),
      emergencyContact: Joi.string()
        .trim()
        .max(15)
        .optional(),
      routeType: Joi.string()
        .valid('regular', 'express', 'circular')
        .optional(),
      operatingDays: Joi.array()
        .items(
          Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
        )
        .optional(),
      specialInstructions: Joi.string()
        .trim()
        .max(500)
        .optional()
    }).optional(),
    updateAnalytics: Joi.object({
      totalTrips: Joi.number().integer().min(0).optional(),
      totalPassengers: Joi.number().integer().min(0).optional(),
      averageRating: Joi.number().min(1).max(5).optional()
    }).optional()
  })
};

// Enhanced Tracking validation schemas for Session 2
const trackingSchemas = {
  locationUpdate: Joi.object({
    routeId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid route ID format'
      }),
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .required()
      .messages({
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90'
      }),
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .required()
      .messages({
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180'
      }),
    accuracy: Joi.number()
      .min(0)
      .max(1000)
      .optional(),
    speed: Joi.number()
      .min(0)
      .max(200)
      .optional(),
    heading: Joi.number()
      .min(0)
      .max(360)
      .optional(),
    altitude: Joi.number()
      .min(-500)
      .max(10000)
      .optional(),
    locationSource: Joi.string()
      .valid('GPS', 'Network', 'Passive', 'Fused')
      .default('GPS'),
    deviceInfo: Joi.object({
      deviceId: Joi.string().optional(),
      platform: Joi.string().valid('iOS', 'Android', 'Web').optional(),
      appVersion: Joi.string().optional(),
      batteryLevel: Joi.number().min(0).max(100).optional()
    }).optional(),
    networkInfo: Joi.object({
      connectionType: Joi.string().valid('wifi', '4g', '3g', '2g', 'offline').optional(),
      signalStrength: Joi.number().min(0).max(100).optional()
    }).optional(),
    environmentalData: Joi.object({
      temperature: Joi.number().min(-50).max(60).optional(),
      weather: Joi.string().max(50).optional(),
      visibility: Joi.number().min(0).max(10000).optional(),
      roadCondition: Joi.string()
        .valid('good', 'fair', 'poor', 'construction', 'flooded')
        .optional()
    }).optional(),
    passengerCount: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .optional()
  }),

  studentStop: Joi.object({
    routeId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    stopId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    notificationPreferences: Joi.object({
      busApproaching: Joi.boolean().default(true),
      busArriving: Joi.boolean().default(true),
      delays: Joi.boolean().default(true),
      tripStart: Joi.boolean().default(true)
    }).optional()
  }),

  reportDelay: Joi.object({
    routeId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    delayMinutes: Joi.number()
      .integer()
      .min(1)
      .max(120)
      .required()
      .messages({
        'number.min': 'Delay must be at least 1 minute',
        'number.max': 'Delay cannot exceed 120 minutes'
      }),
    reason: Joi.string()
      .trim()
      .max(200)
      .optional(),
    stopId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    severity: Joi.string()
      .valid('low', 'medium', 'high', 'critical')
      .default('medium')
  }),

  tripStart: Joi.object({
    expectedPassengers: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .optional(),
    departureTime: Joi.date()
      .optional(),
    notes: Joi.string()
      .trim()
      .max(500)
      .optional()
  }),

  tripEnd: Joi.object({
    finalPassengerCount: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .optional(),
    notes: Joi.string()
      .trim()
      .max(500)
      .optional(),
    rating: Joi.number()
      .min(1)
      .max(5)
      .optional()
  })
};

// Admin validation schemas  
const adminSchemas = {
  updateUserStatus: Joi.object({
    isActive: Joi.boolean()
      .required()
  }),

  emergencyAlert: Joi.object({
    routeId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    message: Joi.string()
      .trim()
      .min(10)
      .max(500)
      .required(),
    instructions: Joi.string()
      .trim()
      .max(500)
      .optional(),
    severity: Joi.string()
      .valid('low', 'medium', 'high', 'critical')
      .default('high')
  }),

  scheduleChange: Joi.object({
    routeId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
    changes: Joi.string()
      .trim()
      .min(10)
      .max(500)
      .required(),
    effectiveDate: Joi.date()
      .min('now')
      .optional()
  })
};

// New validation for Session 2 features
const analyticsSchemas = {
  dateRange: Joi.object({
    days: Joi.number()
      .integer()
      .min(1)
      .max(90)
      .default(7),
    includeRecommendations: Joi.boolean()
      .default(true),
    includeRaw: Joi.boolean()
      .default(false)
  }),

  weatherAlert: Joi.object({
    routeIds: Joi.array()
      .items(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
      )
      .min(1)
      .required(),
    condition: Joi.string()
      .trim()
      .min(5)
      .max(100)
      .required(),
    advice: Joi.string()
      .trim()
      .max(200)
      .required(),
    isExtreme: Joi.boolean()
      .default(false)
  })
};

// Validation middleware factory with enhanced error handling
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }

    req.body = value; // Use validated and sanitized data
    next();
  };
};

// Query parameter validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Query validation failed',
        details: errorDetails,
        timestamp: new Date().toISOString()
      });
    }

    req.query = value;
    next();
  };
};

// Create route validation middleware using schema name
const routeValidation = validate(routeSchemas.createRoute);
const trackingValidation = validate(trackingSchemas.locationUpdate);

module.exports = {
  userSchemas,
  routeSchemas, 
  trackingSchemas,
  adminSchemas,
  analyticsSchemas,
  validate,
  validateQuery,
  routeValidation,
  trackingValidation
};