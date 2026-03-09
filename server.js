const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;
let activeRooms = {};
let onlineCount = 0;

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('updateCount', onlineCount);

    socket.on('findPartner', () => {
        if (waitingUser && waitingUser.id !== socket.id) {
            const partner = waitingUser;
            waitingUser = null;
            const roomName = `room-${socket.id}-${partner.id}`;
            socket.join(roomName);
            partner.join(roomName);
            activeRooms[socket.id] = { room: roomName, partner: partner.id };
            activeRooms[partner.id] = { room: roomName, partner: socket.id };
            io.to(roomName).emit('matched', roomName);
        } else {
            waitingUser = socket;
            socket.emit('waiting', 'Searching for a Pori...');
        }
    });

    socket.on('newMessage', (data) => {
        socket.to(data.room).emit('receiveMessage', { type: 'text', content: data.message });
    });

    socket.on('sendImage', (data) => {
        socket.to(data.room).emit('receiveMessage', { type: 'image', content: data.image });
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('partnerTyping', true);
    });

    socket.on('stopTyping', (data) => {
        socket.to(data.room).emit('partnerTyping', false);
    });

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('updateCount', onlineCount);
        const roomData = activeRooms[socket.id];
        if (roomData) {
            io.to(roomData.room).emit('partnerDisconnected');
            delete activeRooms[roomData.partner];
            delete activeRooms[socket.id];
        }
        if (waitingUser && waitingUser.id === socket.id) waitingUser = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`PoriChat Pro+ live`));
