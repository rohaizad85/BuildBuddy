// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CORS CONFIGURATION
// ============================================

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer', 'Accept'],
    credentials: false,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

// ============================================
// LOGGING
// ============================================

app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
});

// ============================================
// GEMINI AI INITIALIZATION
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('🔑 GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ Found' : '❌ Not found');

let model = null;
if (GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('✅ Gemini AI initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Gemini AI:', error.message);
    }
}

// ============================================
// API: PRODUCT DETECTION - FIXED
// ============================================

app.post('/api/detect-product', async (req, res) => {
    console.log('📥 POST /api/detect-product');
    console.log('📦 Body:', req.body);

    try {
        const { productName } = req.body;
        
        if (!productName || productName.trim().length < 3) {
            console.log('❌ Product name too short');
            return res.status(400).json({ 
                error: 'Please enter a valid product name (minimum 3 characters)'
            });
        }

        if (!model) {
            console.log('❌ Gemini model not available');
            return res.status(503).json({
                error: 'AI service unavailable',
                fallback: {
                    brand: '',
                    category: 'other',
                    confidence: 'low',
                    suggestedName: productName,
                    fullName: productName,
                    possibleSpecs: {},
                    commonAlternatives: [],
                    typicalPrice: '',
                    description: ''
                }
            });
        }

        console.log('🔍 Detecting product:', productName);

        // Simplified prompt to reduce token usage and errors
        const prompt = `
Analyze this product name: "${productName}"

Return JSON only:
{
    "brand": "brand name",
    "category": "cpu/gpu/motherboard/ram/storage/psu/cooler/case/monitor/other",
    "confidence": "high/medium/low",
    "suggestedName": "clean name without brand",
    "fullName": "full product name",
    "possibleSpecs": {
        "generation": "generation info",
        "model": "model number",
        "capacity": "size/capacity",
        "additional": "extra specs"
    },
    "commonAlternatives": [],
    "typicalPrice": "RM price range",
    "description": "short description"
}`;

        console.log('📤 Sending to Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('📝 AI Response length:', text.length);
        console.log('📝 AI Response:', text.substring(0, 200));
        
        // Extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.log('❌ No JSON found in response');
            return res.status(500).json({
                error: 'Could not parse AI response',
                fallback: {
                    brand: '',
                    category: 'other',
                    confidence: 'low',
                    suggestedName: productName,
                    fullName: productName,
                    possibleSpecs: {},
                    commonAlternatives: [],
                    typicalPrice: '',
                    description: ''
                }
            });
        }
        
        const parsedResult = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed result:', parsedResult);
        
        res.json(parsedResult);
        
    } catch (error) {
        console.error('❌ Product detection error:', error.message);
        console.error('❌ Stack:', error.stack);
        
        // Return a fallback response instead of crashing
        res.status(500).json({
            error: 'Failed to detect product info',
            message: error.message,
            fallback: {
                brand: '',
                category: 'other',
                confidence: 'low',
                suggestedName: req.body?.productName || '',
                fullName: req.body?.productName || '',
                possibleSpecs: {},
                commonAlternatives: [],
                typicalPrice: '',
                description: ''
            }
        });
    }
});

// ============================================
// API: AI COMPATIBILITY CHECK
// ============================================

app.post('/api/gemini-compat', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!model) {
            return res.json({
                compatible: true,
                confidence: 'low',
                summary: 'AI service unavailable',
                compatibility: [],
                partDetails: [],
                suggestions: [],
                estimatedWattage: 500,
                warnings: [{ message: 'AI service unavailable', severity: 'low' }]
            });
        }

        console.log('🔍 Running compatibility check...');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse AI response');
        }
        
        const parsedResult = JSON.parse(jsonMatch[0]);
        console.log('✅ Compatibility result:', parsedResult);
        
        res.json(parsedResult);
        
    } catch (error) {
        console.error('❌ Compatibility check error:', error.message);
        res.status(500).json({
            error: 'Failed to check compatibility',
            message: error.message,
            fallback: {
                compatible: true,
                confidence: 'low',
                summary: 'AI service unavailable',
                compatibility: [],
                partDetails: [],
                suggestions: [],
                estimatedWattage: 500,
                warnings: [{ message: 'AI service unavailable', severity: 'low' }]
            }
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        gemini: model ? 'configured' : 'not configured'
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, '..')}`);
    console.log(`🤖 Gemini AI: ${model ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`📡 Endpoints:`);
    console.log(`   POST /api/detect-product`);
    console.log(`   POST /api/gemini-compat`);
    console.log(`   GET  /api/health`);
});