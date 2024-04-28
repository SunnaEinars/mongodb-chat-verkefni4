import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import moment from 'moment'; // Make sure to install moment with 'npm install moment'
import mongoose from 'mongoose';

const app = express();
const server = createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/chat-test-2')
  .then(() => console.log('Chat test 2 running'))
  .catch(err => console.error('Chat test 2 connection error: ', err));


// connecting to the HTML File
const __dirname = dirname(fileURLToPath(import.meta.url));
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// connect js and css to index.html
app.use('/static', express.static('static'));
app.use('/js', express.static('js'));


// Chat MongoDB Schemas

// ROOMS

const RoomSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  users: [String]
});

const Room = mongoose.model('Room', RoomSchema);
const rooms = { "Main": { users: [] } }; // Initialize with the "Main" room

// USERS

io.on('connection', (socket) => {
  console.log('a user has connected');

  socket.on('disconnect', () => {
    console.log('user idsconnected');
  });
});



// MESSAGES
const MessageSchema = new mongoose.Schema({
  room: String,
  userName: String,
  message: String,
  time: String
});

const Message = mongoose.model('Message', MessageSchema);

// When connecting to chat 

io.on('connection', (socket) => {


  // Starting point upon entering chat app
  Room.find().distinct('name').then(rooms => {
    socket.emit('update room list', rooms);
  }).catch(err => {
    console.error('Error fetching rooms:', err);
  });

  // Askt user to pick a name
  socket.emit('chooseName'); // Prompt the client to choose a name

  // How and where username is used
  socket.on('chooseName', (userName) => {
    socket.userName = userName;


    
  });

  // Joining a room
  socket.on('join room', (roomName) => {
    Room.findOne({name: roomName}).then(room => {
      if (!Room) {
        console.error(`Room ${roomName} does not exist.`);
        return; // Exit early if room doesn't exist
      }
      socket.leave(socket.currentRoom); // Leave the current room
      socket.join(roomName);
      socket.currentRoom = roomName;
      if (!room.users.includes(socket.userName)) {
        room.users.push(socket.userName);
        room.save();
      }
      socket.emit('update current room', roomName);
      io.to(roomName).emit('updateUserList', room.users);
      socket.to(roomName).emit('chat message', `${socket.userName} has joined the room.`);
    }).catch(err => {
      console.error('Error joining room:', err);
    });
  });

  // Send Messages
  socket.on('chat message', (msg) => {
    const formattedTime = moment().format('HH:mm');
    const messageWithTimestamp = `${formattedTime} - ${socket.userName}: ${msg}`;
    const newMessage = new Message({
      room: socket.currentRoom,
      userName: socket.userName,
      message: msg,
      time: formattedTime
    });
    newMessage.save().then(() => {
      io.to(socket.currentRoom).emit('chat message', messageWithTimestamp);
    }).catch(err => {
      console.error('Error saving message:', err);
    });
  });

  // Join a room
  socket.on('join room', (roomName) => {
    Room.findOne({name: roomName}).then(room => {
      if (!room) {
        console.error(`Room ${roomName} does not exist.`);
        return; // Exit early if room doesn't exist
      }
      socket.leave(socket.currentRoom); // Leave the current room
      socket.join(roomName);
      socket.currentRoom = roomName;
      if (!room.users.includes(socket.userName)) {
        room.users.push(socket.userName);
        room.save();
      }
      socket.emit('update current room', roomName);
      io.to(roomName).emit('updateUserList', room.users);
      socket.to(roomName).emit('chat message', `${socket.userName} has joined the room.`);
    }).catch(err => {
      console.error('Error joining room:', err);
    });
  });

  // Disconnect from a room
  socket.on('disconnect', () => {
    if (socket.currentRoom) {
      Room.findOne({name: socket.currentRoom}).then(room => {
        if (room) {
          const index = room.users.indexOf(socket.userName);
          if (index !== -1) {
            room.users.splice(index, 1);
            room.save();
          }
        }
        socket.to(socket.currentRoom).emit('chat message', `${socket.userName} has left the room.`);
      }).catch(err => {
        console.error('Error on disconnect:', err);
      });
    }
  });


  // Create new rooms
  socket.on('create room', (roomName) => {
    Room.findOne({ name: roomName }).then(room => {
      if (!room) {
        const newRoom = new Room({ name: roomName, users: [] });
        newRoom.save().then(() => {
          // Fetch updated room list after creating a new room and emit to all clients
          Room.find().distinct('name').then(rooms => {
            io.emit('update room list', rooms);
          }).catch(err => {
            console.error('Error fetching rooms after creating new room:', err);
          });
        });
      }
    }).catch(err => {
      console.error('Error creating room:', err);
    });
  });

  
  // Delete rooms 
  socket.on('delete room', (roomName) => {
    socket.emit('delete room', roomName); // Emit an event to delete the room
  });

});





// Server listener
server.listen(3000, () => {
  console.log('Chat app test 2 connection has been established');
});