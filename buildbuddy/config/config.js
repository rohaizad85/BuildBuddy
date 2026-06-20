// D:\Ijad\Y3S2\FYP\Project\buildbuddy\config\config.js

const CONFIG = {
    // Supabase Configuration
    supabase: {
        url: 'https://kkloxbmybhoawojaovtj.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbG94Ym15YmhvYXdvamFvdnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTUwMjQsImV4cCI6MjA5MjA5MTAyNH0.EMFgfc4f1jEdZ1Iv6FnCA01v_jdjYXIMTlGyNRLTeeo'         
    },

    // OpenAI API Configuration
    openai: {
        apiKey: '', // Add your OpenAI API key here if needed
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo',
        maxTokens: 500,
        temperature: 0.7
    },

    // API Endpoints
    api: {
        geminiCompat: 'http://localhost:3000/api/gemini-compat',
        geminiChat: 'http://localhost:3000/api/gemini-chat'
    },

    // Application Configuration
    app: {
        name: 'BuildBuddy',
        version: '1.0.0'
    }
};

// Export for ES modules
export default CONFIG;

// For backward compatibility with script tags
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}