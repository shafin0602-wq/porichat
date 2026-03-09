const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;

io.on('connection', (socket) => {
    socket.on('findPartner', () => {
        if (waitingUser && waitingUser.id !== socket.id) {
            const partner = waitingUser;
            waitingUser = null;

            const roomName = `room-${socket.id}-${partner.id}`;
            socket.join(roomName);
            partner.join(roomName);

            io.to(roomName).emit('matched', roomName);
        } else {
            waitingUser = socket;
            socket.emit('waiting', 'Summoning a Pori...');
        }
    });

    socket.on('newMessage', (data) => {
        socket.to(data.room).emit('receiveMessage', data.message);
    });

    socket.on('disconnect', () => {
        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`PoriChat live on port ${PORT}`);
});
