const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 }); // ১০ এমবি পর্যন্ত ইমেজ সাপোর্ট

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;
let activeRooms = {}; // রুম ট্র্যাকিং
let bannedUsers = new Set(); // ব্যান করা ইউজারদের লিস্ট

io.on('connection', (socket) => {
    // ব্যান চেক
    if (bannedUsers.has(socket.id)) {
        socket.emit('banned', 'You are banned for violating rules.');
        socket.disconnect();
        return;
    }

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
            socket.emit('waiting', 'Summoning a Pori...');
        }
    });

    socket.on('newMessage', (data) => {
        socket.to(data.room).emit('receiveMessage', { type: 'text', content: data.message });
    });

    socket.on('sendImage', (data) => {
        socket.to(data.room).emit('receiveMessage', { type: 'image', content: data.image });
    });

    socket.on('reportUser', () => {
        const roomData = activeRooms[socket.id];
        if (roomData) {
            console.log(`User ${roomData.partner} has been reported!`);
            // এখানে আপনি ডাটাবেসে সেভ করতে পারেন
            socket.emit('systemMsg', 'Partner reported. Admin will review.');
        }
    });

    socket.on('disconnect', () => {
        if (waitingUser && waitingUser.id === socket.id) waitingUser = null;
        delete activeRooms[socket.id];
    });
});

// একটি সিম্পল অ্যাডমিন রাউট (ব্রাউজারে /admin-pori লিখে ঢুকবেন)
app.get('/admin-pori', (req, res) => {
    res.send(`<h1>Admin Panel</h1><p>Active Users: ${io.engine.clientsCount}</p>`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`PoriChat Pro live on ${PORT}`));
