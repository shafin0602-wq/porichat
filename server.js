const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname, 'public')));

let queue = [];
let users = {};
let bannedIPs = new Set();

io.on('connection', (socket) => {
    const userIP = socket.handshake.address;

    // ব্যান চেক
    if (bannedIPs.has(userIP)) {
        socket.emit('error_msg', 'You are permanently banned.');
        socket.disconnect();
        return;
    }

    users[socket.id] = { id: socket.id, ip: userIP, room: null, partner: null, status: 'Idle' };
    updateAdminStats();

    socket.on('findPartner', () => {
        users[socket.id].status = 'Searching';
        queue = queue.filter(id => id !== socket.id);

        if (queue.length > 0) {
            const partnerId = queue.shift();
            const roomName = `room_${socket.id}_${partnerId}`;
            socket.join(roomName);
            const partnerSocket = io.sockets.sockets.get(partnerId);
            
            if (partnerSocket) {
                partnerSocket.join(roomName);
                users[socket.id].room = roomName;
                users[socket.id].partner = partnerId;
                users[socket.id].status = 'Chatting';
                users[partnerId].room = roomName;
                users[partnerId].partner = socket.id;
                users[partnerId].status = 'Chatting';
                io.to(roomName).emit('matched');
            } else {
                queue.push(socket.id);
            }
        } else {
            queue.push(socket.id);
        }
        updateAdminStats();
    });

    socket.on('message', (msg) => {
        const user = users[socket.id];
        if (user && user.room) socket.to(user.room).emit('message', { type: 'text', text: msg });
    });

    // অ্যাডমিন কমান্ডস
    socket.on('admin_kick', (targetId) => {
        const target = io.sockets.sockets.get(targetId);
        if (target) target.disconnect();
    });

    socket.on('admin_ban', (targetId) => {
        if (users[targetId]) {
            bannedIPs.add(users[targetId].ip);
            const target = io.sockets.sockets.get(targetId);
            if (target) target.disconnect();
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user && user.partner) {
            const partnerSocket = io.sockets.sockets.get(user.partner);
            if (partnerSocket) {
                users[user.partner].room = null;
                users[user.partner].partner = null;
                users[user.partner].status = 'Idle';
                partnerSocket.emit('partnerLeft');
            }
        }
        queue = queue.filter(id => id !== socket.id);
        delete users[socket.id];
        updateAdminStats();
    });
});

function updateAdminStats() {
    io.emit('admin_data', {
        onlineCount: Object.keys(users).length,
        users: Object.values(users)
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('PoriChat Server Active'));
