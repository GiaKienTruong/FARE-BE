const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FARE API Documentation',
            version: '1.0.0',
            description: 'AI-Powered Virtual Try-On Platform API',
            contact: {
                name: 'FARE Team',
                email: 'hello@fare-app.com',
            },
            license: {
                name: 'Private',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
            {
                url: 'https://your-production-url.com',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Firebase ID Token',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        email: { type: 'string', example: 'user@example.com' },
                        display_name: { type: 'string', example: 'John Doe' },
                        height: { type: 'integer', example: 175 },
                        weight: { type: 'integer', example: 70 },
                        gender: { type: 'string', example: 'male' },
                        subscription_tier: { type: 'string', example: 'free' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                ClothingItem: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        user_id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Blue Denim Jacket' },
                        category: {
                            type: 'string',
                            enum: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'],
                            example: 'outerwear'
                        },
                        brand: { type: 'string', example: 'Zara' },
                        color: { type: 'string', example: 'blue' },
                        size: { type: 'string', example: 'M' },
                        original_image_url: { type: 'string', example: 'https://cloudinary.com/image.jpg' },
                        favorite: { type: 'boolean', example: false },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Outfit: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        user_id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Casual Friday' },
                        occasion: { type: 'string', example: 'work' },
                        season: { type: 'string', example: 'summer' },
                        item_ids: {
                            type: 'array',
                            items: { type: 'integer' },
                            example: [1, 2, 3]
                        },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'object',
                            properties: {
                                message: { type: 'string', example: 'Error message' },
                                status: { type: 'integer', example: 400 },
                            },
                        },
                    },
                },
            },
        },
        security: [
            {
                BearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;