const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || process.env.MONGO_URL;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB Atlas");
}).catch(err => {
    console.error("MongoDB connection error:", err);
});

// User Schema & Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
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
        console.error("Error details:", error);
        res.status(500).json({ success: false, message: error.message });
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
        console.error("Error details:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Socket.io Matchmaking & Game Logic
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('find_match', (data) => {
        if (waitingPlayer) {
            // Match found
            const roomName = `room_${waitingPlayer.id}_${socket.id}`;
            socket.join(roomName);
            waitingPlayer.join(roomName);

            io.to(roomName).emit('match_found', { room: roomName, message: 'Match started!' });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', { message: 'Looking for an opponent...' });
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
