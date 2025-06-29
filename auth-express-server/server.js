// firebase-auth-server/server.js
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});

// In-memory user store (replace with DB in production)
const users = {};

// Create account
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    if (users[email]) return res.status(409).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const uid = `user_${email.replace(/[@.]/g, '_')}`;
    users[email] = { uid, email, hashedPassword };

    try {
        const customToken = await admin.auth().createCustomToken(uid);
        res.json({ token: customToken, user: { uid, email } });
    } catch (err) {
        console.error('Token creation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = users[email];
    if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    try {
        const customToken = await admin.auth().createCustomToken(user.uid);
        res.json({ token: customToken, user: { uid: user.uid, email } });
    } catch (err) {
        console.error('Token creation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Auth server running on http://localhost:${PORT}`));
