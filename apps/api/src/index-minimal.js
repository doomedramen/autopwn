"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables based on NODE_ENV
require("dotenv-flow/config");
var node_server_1 = require("@hono/node-server");
var hono_1 = require("hono");
var logger_1 = require("hono/logger");
var pretty_json_1 = require("hono/pretty-json");
var cors_1 = require("hono/cors");
var app = new hono_1.Hono();
// Security and utility middleware (applied globally)
app.use('*', (0, logger_1.logger)());
app.use('*', (0, pretty_json_1.prettyJSON)());
// Production-ready CORS configuration
app.use('*', (0, cors_1.cors)({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
// Health check endpoint (production ready)
app.get('/health', function (c) {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'autopwn-api',
        version: '1.0.0-minimal',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});
// API info endpoint
app.get('/api/info', function (c) {
    return c.json({
        message: 'AutoPWN Minimal API - Working Docker Setup',
        version: '1.0.0-minimal',
        environment: process.env.NODE_ENV || 'development',
        endpoints: [
            { path: '/health', method: 'GET', description: 'Service health check' },
            { path: '/api/info', method: 'GET', description: 'API information' },
            { path: '/api/auth/login', method: 'POST', description: 'User login (mock)' },
            { path: '/api/auth/register', method: 'POST', description: 'User registration (mock)' }
        ],
        infrastructure: {
            database: 'PostgreSQL 16',
            cache: 'Redis 7',
            reverse_proxy: 'Nginx',
            orchestrator: 'Docker Compose'
        }
    });
});
// Mock authentication endpoints (ready for Better Auth integration)
app.post('/api/auth/login', function (c) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, password;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, c.req.json()
                // Basic validation
            ];
            case 1:
                _a = _b.sent(), email = _a.email, password = _a.password;
                // Basic validation
                if (!email || !password) {
                    return [2 /*return*/, c.json({
                            success: false,
                            error: 'Email and password are required'
                        }, 400)];
                }
                // Mock authentication (replace with Better Auth implementation)
                return [2 /*return*/, c.json({
                        success: true,
                        message: 'Login endpoint ready for Better Auth integration',
                        user: {
                            id: 'mock-user-id',
                            email: email,
                            role: 'user'
                        }
                    })];
        }
    });
}); });
app.post('/api/auth/register', function (c) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, password, name;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, c.req.json()
                // Basic validation
            ];
            case 1:
                _a = _b.sent(), email = _a.email, password = _a.password, name = _a.name;
                // Basic validation
                if (!email || !password) {
                    return [2 /*return*/, c.json({
                            success: false,
                            error: 'Email and password are required'
                        }, 400)];
                }
                // Mock registration (replace with Better Auth implementation)
                return [2 /*return*/, c.json({
                        success: true,
                        message: 'Registration endpoint ready for Better Auth integration',
                        user: {
                            id: 'mock-new-user-id',
                            email: email,
                            name: name || email,
                            role: 'user'
                        }
                    })];
        }
    });
}); });
// Mock database status endpoint
app.get('/api/db/status', function (c) {
    return c.json({
        message: 'Database connection endpoint ready',
        configuration: {
            host: process.env.POSTGRES_HOST || 'database',
            port: process.env.POSTGRES_PORT || '5432',
            database: process.env.POSTGRES_DB || 'autopwn_production',
            user: process.env.POSTGRES_USER || 'postgres'
        },
        status: 'Ready for Drizzle ORM integration'
    });
});
// Mock Redis status endpoint
app.get('/api/redis/status', function (c) {
    return c.json({
        message: 'Redis connection endpoint ready',
        configuration: {
            host: process.env.REDIS_HOST || 'redis',
            port: process.env.REDIS_PORT || '6379'
        },
        status: 'Ready for BullMQ integration'
    });
});
// Mock networks endpoint (placeholder for full implementation)
app.get('/api/networks', function (c) {
    return c.json({
        message: 'Network management endpoint ready',
        networks: [],
        status: 'Ready for full network analysis implementation'
    });
});
// Mock jobs endpoint (placeholder for full implementation)
app.get('/api/jobs', function (c) {
    return c.json({
        message: 'Job management endpoint ready',
        jobs: [],
        status: 'Ready for full Hashcat integration'
    });
});
// Error handling
app.onError(function (err, c) {
    console.error('API Error:', err);
    return c.json({
        success: false,
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    }, 500);
});
// 404 handler
app.notFound(function (c) {
    return c.json({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: c.req.path,
        method: c.req.method,
        available_endpoints: [
            '/health',
            '/api/info',
            '/api/auth/login',
            '/api/auth/register',
            '/api/db/status',
            '/api/redis/status',
            '/api/networks',
            '/api/jobs'
        ]
    }, 404);
});
var port = parseInt(process.env.PORT || '3001');
console.log("\uD83D\uDE80 AutoPWN Minimal API Server starting on port ".concat(port));
console.log("\uD83D\uDCCD Environment: ".concat(process.env.NODE_ENV || 'development'));
console.log("\uD83D\uDD17 Health check: http://localhost:".concat(port, "/health"));
console.log("\uD83D\uDCCA API info: http://localhost:".concat(port, "/api/info"));
console.log("\uD83D\uDCBE Database: PostgreSQL on port ".concat(process.env.POSTGRES_PORT || '5432'));
console.log("\u26A1 Redis: on port ".concat(process.env.REDIS_PORT || '6379'));
exports.default = {
    port: port,
    fetch: app.fetch,
};
// Start server
(0, node_server_1.serve)({
    fetch: app.fetch,
    port: port,
}).on('error', function (error) {
    console.error('❌ Server encountered an error', error);
    process.exit(1);
});
