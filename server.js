const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('MongoDB Connected Successfully!'))
        .catch(err => console.error('MongoDB Connection Error:', err));
}

// User & Wallet Schema ($1 to $50,000 limits)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// Deposit Request Schema (Easypaisa, JazzCash, Bank)
const depositSchema = new mongoose.Schema({
    username: { type: String, required: true },
    method: { type: String, required: true }, // 'Easypaisa', 'JazzCash', 'Bank'
    amount: { type: Number, required: true, min: 1, max: 50000 }, // Limits $1 - $50,000
    transactionId: { type: String, required: true },
    status: { type: String, default: 'Pending' }, // 'Pending', 'Approved', 'Rejected'
    createdAt: { type: Date, default: Date.now }
});
const Deposit = mongoose.model('Deposit', depositSchema);

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
        res.json({ success: true, message: 'Login successful', balance: user.balance, username: user.username });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deposit Request Route ($1 - $50,000 validation)
app.post('/api/deposit', async (req, res) => {
    try {
        const { username, method, amount, transactionId } = req.body;
        
        if (amount < 1 || amount > 50000) {
            return res.status(400).json({ success: false, message: 'Deposit amount must be between $1 and $50,000' });
        }

        const newDeposit = new Deposit({
            username,
            method,
            amount,
            transactionId,
            status: 'Pending'
        });

        await newDeposit.save();
        res.json({ success: true, message: 'Deposit request submitted successfully! Waiting for admin approval.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Socket.io Connection
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
