// firebase-auth-server/server.js
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors({
    origin: '*', // In production, use specific origin: chrome-extension://<your-extension-id>
}));
app.use(express.json());

// Initialize Firebase Admin SDK
try {
    console.log('🛠 Initializing Firebase Admin SDK...');
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Firebase service account loaded successfully');
    admin.initializeApp({
        credential: admin.credential.cert(credentials),
    });
    console.log('✅ Firebase Admin SDK initialized');
} catch (err) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', err);
    process.exit(1); // Exit immediately since Firebase is required
}

// In-memory user store (replace with DB in production)
const users = {};

app.post('/auth/register', async (req, res) => {
    console.log('📥 /auth/register request received');
    const { email, password } = req.body;

    console.log(`📧 Registering user: ${email}`);

    if (!email || !password) {
        console.warn('⚠️ Email or password missing');
        return res.status(400).json({ error: 'Email and password required' });
    }

    if (users[email]) {
        console.warn('⚠️ User already exists:', email);
        return res.status(409).json({ error: 'User already exists' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const uid = `user_${email.replace(/[@.]/g, '_')}`;
        users[email] = { uid, email, hashedPassword };
        console.log(`🔐 Hashed password stored for user ${uid}`);

        const customToken = await admin.auth().createCustomToken(uid);
        console.log(`✅ Custom token created for UID ${uid}`);

        res.json({ token: customToken, user: { uid, email } });
    } catch (err) {
        console.error('❌ Error during registration:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/auth/login', async (req, res) => {
    console.log('📥 /auth/login request received');
    const { email, password } = req.body;

    console.log(`🔐 Attempting login for: ${email}`);

    if (!email || !password) {
        console.warn('⚠️ Email or password missing');
        return res.status(400).json({ error: 'Email and password required' });
    }

    const user = users[email];
    if (!user) {
        console.warn('❌ User not found:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordMatch) {
        console.warn('❌ Incorrect password for:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    try {
        const customToken = await admin.auth().createCustomToken(user.uid);
        console.log(`✅ Login successful for ${email}, token created`);
        res.json({ token: customToken, user: { uid: user.uid, email } });
    } catch (err) {
        console.error('❌ Token creation failed during login:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Auth server running on http://0.0.0.0:${PORT}`);
});
