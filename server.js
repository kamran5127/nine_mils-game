const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = []; // Connected players track karne ke liye

io.on('connection', (socket) => {
    console.log('Ek naya player connect ho gaya:', socket.id);

    // Player role assign karein
    if (players.length < 2) {
        players.push(socket.id);
        const role = players.length === 1 ? 'red' : 'blue'; // Pehla Red, doosra Blue
        socket.emit('assigned-role', role);
        console.log(`Player ko role mila: ${role}`);
    } else {
        socket.emit('assigned-role', 'spectator'); // 2 se zyada hon toh spectator
    }

    // Move update doosre player ko bhejna
    socket.on('player-move', (data) => {
        socket.broadcast.emit('board-update', data);
    });

    socket.on('disconnect', () => {
        players = players.filter(id => id !== socket.id);
        console.log('Player disconnect ho gaya:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});