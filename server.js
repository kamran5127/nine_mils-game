const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection (Using MONGO_URL from environment variable)
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('MongoDB Connected Successfully!'))
        .catch(err => console.error('MongoDB Connection Error:', err));
}

// User & Wallet Schema (Supports betting limits & balances)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 } // Wallet balance for real-money gaming ($1 to $50,000)
});

const User = mongoose.model('User', userSchema);

// Sign-up Route
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        const newUser = new User({ username, password, balance: 0 });
        await newUser.save();
        res.json({ success: true, message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }
        res.json({ success: true, message: 'Login successful', balance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Socket.io Connection for Game Live Events
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
