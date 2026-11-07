const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

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

// Deposit Request Schema
const depositSchema = new mongoose.Schema({
    username: { type: String, required: true },
    method: { type: String, required: true },
    amount: { type: Number, required: true, min: 1, max: 50000 },
    transactionId: { type: String, required: true },
    status: { type: String, default: 'Pending' },
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

// Deposit Request Route
app.post('/api/deposit', async (req, res) => {
    try {
        const { username, method, amount, transactionId } = req.body;
        if (amount < 1 || amount > 50000) {
            return res.status(400).json({ success: false, message: 'Amount must be between $1 and $50,000' });
        }
        const newDeposit = new Deposit({ username, method, amount, transactionId, status: 'Pending' });
        await newDeposit.save();
        res.json({ success: true, message: 'Deposit request submitted successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Socket.io Game Matchmaking & Moves
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('find-game', (username) => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Match found! Create a room
            const roomName = `room_${waitingPlayer.id}_${socket.id}`;
            socket.join(roomName);
            waitingPlayer.join(roomName);

            io.to(roomName).emit('game-start', {
                room: roomName,
                player1: waitingPlayer.username,
                player2: username
            });
            waitingPlayer = null;
        } else {
            waitingPlayer = { id: socket.id, username, join: (r) => socket.join(r) };
            socket.emit('waiting', 'Looking for an opponent...');
        }
    });

    socket.on('make-move', (data) => {
        socket.to(data.room).emit('move-made', data);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
