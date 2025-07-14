// Dependencies
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const formatMessage = require('./utils/messages');

// User management functions
const users = [];
function userJoin(id, username, room) {
   const user = { id, username, room };
   const existing = users.find(u => u.id === id);
   if (!existing) users.push(user);
   return user;
}
function getCurrentUser(id) {
   return users.find((user) => user.id === id);
}
function userLeave(id) {
   const index = users.findIndex((user) => user.id === id);
   if (index !== -1) {
      return users.splice(index, 1)[0];
   }
}
function getRoomUsers(room) {
   return users.filter((user) => user.room === room);
}

const app = express(); 

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/whatsappwebapp');
const db = mongoose.connection;
db.on('error', (err) => console.error('❌ MongoDB connection error:', err));
db.once('open', () => console.log('✅ MongoDB connected successfully!'));

// User schema and model
const userSchema = new mongoose.Schema({
   email: { type: String, required: true, unique: true },
   username: { type: String, required: true, unique: true },
   password: { type: String, required: true },
   profilePicUrl: { type: String, default: '' },
});
const User = mongoose.model('User', userSchema);

// Group schema and model
const groupSchema = new mongoose.Schema({
   name: { type: String, required: true, unique: true },
   creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   createdAt: { type: Date, default: Date.now },
});
const Group = mongoose.model('Group', groupSchema);

// Message schema and model
const messageSchema = new mongoose.Schema({
   room: String, // group name or private room name
   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // for private
   text: String,
   file: {
      fileName: String,
      originalName: String,
      filePath: String,
   },
   time: { type: Date, default: Date.now },
   readBy: [{ type: String }], // usernames who have read the message
   edited: { type: Boolean, default: false },
   editedAt: { type: Date },
});
const Message = mongoose.model('Message', messageSchema);

// Session middleware
app.use(
   session({
      secret: 'supersecretkey',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/whatsappwebapp' }),
      cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
   })
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/profile', express.static(path.join(__dirname, 'uploads/profile')));

// Multer storage configurations
const profilePicStorage = multer.diskStorage({
   destination: function (req, file, cb) {
      cb(null, 'uploads/profile/');
   },
   filename: function (req, file, cb) {
      cb(null, `${Date.now()}-${file.originalname}`);
   },
});

const fileStorage = multer.diskStorage({
   destination: 'uploads/',
   filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
   },
});

const signupUpload = multer({ storage: profilePicStorage });
const upload = multer({ storage: fileStorage });
const profilePicUpload = multer({ storage: profilePicStorage });

// Authentication middleware
function requireAuth(req, res, next) {
   if (!req.session.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
   }
   next();
}

// Track online users
const onlineUsers = {};
const dashboardClients = new Set();
const botName = 'ChatBot';

// Auth routes
app.post('/signup', signupUpload.single('profilePic'), async (req, res) => {
   const { email, username, password } = req.body;
   if (!email || !username || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
   }
   try {
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
         return res.status(400).json({ message: 'Email or username already exists.' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      let profilePicUrl = '';
      if (req.file) {
         profilePicUrl = `/uploads/profile/${req.file.filename}`;
      }
      const user = new User({ email, username, password: hashedPassword, profilePicUrl });
      await user.save();
      req.session.userId = user._id;
      res.status(201).json({ message: 'Signup successful', user: { email, username, profilePicUrl } });
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.post('/login', async (req, res) => {
   const { email, password } = req.body;
   if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
   }
   try {
      const user = await User.findOne({ email });
      if (!user) {
         return res.status(400).json({ message: 'Invalid credentials.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
         return res.status(400).json({ message: 'Invalid credentials.' });
      }
      req.session.userId = user._id;
      res.status(200).json({ message: 'Login successful', user: { email: user.email, username: user.username, profilePicUrl: user.profilePicUrl } });
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.post('/logout', (req, res) => {
   req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: 'Logout failed' });
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logged out' });
   });
});

// API routes
app.get('/api/users', requireAuth, async (req, res) => {
   try {
      const users = await User.find({ _id: { $ne: req.session.userId } }, 'username _id');
      const usersWithStatus = users.map(u => ({
         username: u.username,
         _id: u._id,
         online: !!onlineUsers[u.username]
      }));
      res.json(usersWithStatus);
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.get('/api/groups', requireAuth, async (req, res) => {
   try {
      const groups = await Group.find({}, 'name _id creator').populate('creator', 'username');
      res.json(groups);
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.post('/api/groups', requireAuth, async (req, res) => {
   const { name } = req.body;
   if (!name) return res.status(400).json({ message: 'Group name required' });
   try {
      const existing = await Group.findOne({ name });
      if (existing) return res.status(400).json({ message: 'Group already exists' });
      const group = new Group({ name, creator: req.session.userId });
      await group.save();
      await group.populate('creator', 'username');
      io.emit('groupCreated', { group: group });
      res.status(201).json({ message: 'Group created', group });
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.delete('/api/groups/:id', requireAuth, async (req, res) => {
   try {
      const group = await Group.findById(req.params.id);
      if (!group) return res.status(404).json({ message: 'Group not found' });
      
      if (!group.creator || group.creator.toString() !== req.session.userId) {
         return res.status(403).json({ message: 'You did not create this group and cannot delete it.' });
      }
      
      await Message.deleteMany({ room: group.name });
      await Group.findByIdAndDelete(req.params.id);
      io.emit('groupDeleted', { groupId: req.params.id, groupName: group.name });
      
      res.json({ message: 'Group and all its messages deleted successfully' });
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.get('/api/me', requireAuth, async (req, res) => {
   try {
      const user = await User.findById(req.session.userId, 'email username _id profilePicUrl');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.get('/api/userpic', requireAuth, async (req, res) => {
   const { username } = req.query;
   if (!username) return res.json({ url: 'img/icons8-chat-64.png' });
   const user = await User.findOne({ username });
   if (user && user.profilePicUrl) {
      res.json({ url: user.profilePicUrl });
   } else {
      res.json({ url: 'img/icons8-chat-64.png' });
   }
});

app.get('/api/messages', requireAuth, async (req, res) => {
   const { type, room, user } = req.query;
   try {
      let messages = [];
      if (type === 'group' && room) {
         messages = await Message.find({ room }).populate('sender', 'username').sort({ time: 1 });
      } else if (type === 'private' && user) {
         const currentUser = await User.findById(req.session.userId);
         if (!currentUser) return res.json([]);
         const privateRoom = [currentUser.username, user].sort().join('_');
         messages = await Message.find({ room: privateRoom }).populate('sender', 'username').sort({ time: 1 });
      }
      res.json(messages);
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.delete('/api/messages/:id', requireAuth, async (req, res) => {
   try {
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ message: 'Message not found' });
      if (!message.sender || message.sender.toString() !== req.session.userId) {
         return res.status(403).json({ message: 'You can only delete your own messages.' });
      }
      if (message.file && message.file.filePath) {
         const fs = require('fs');
         const filePath = path.join(__dirname, message.file.filePath);
         fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
               console.error('Error deleting file:', err);
            }
         });
      }
      await Message.findByIdAndDelete(req.params.id);
      res.json({ message: 'Message and file deleted (if any)' });
      io.to(message.room).emit('messageDeleted', { _id: message._id });
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.patch('/api/messages/:id', requireAuth, async (req, res) => {
   try {
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ message: 'Message not found' });
      if (!message.sender || message.sender.toString() !== req.session.userId) {
         return res.status(403).json({ message: 'You can only edit your own messages.' });
      }
      if (message.file && message.file.filePath) {
         return res.status(400).json({ message: 'Cannot edit file messages.' });
      }
      const { text } = req.body;
      if (typeof text !== 'string' || !text.trim()) {
         return res.status(400).json({ message: 'Invalid message text.' });
      }
      message.text = text.trim();
      message.edited = true;
      message.editedAt = new Date();
      await message.save();
      res.json({ message: 'Message edited', editedMessage: message });
      io.to(message.room).emit('messageEdited', { _id: message._id, text: message.text, edited: true, editedAt: message.editedAt });
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.get('/api/recent', requireAuth, async (req, res) => {
   try {
      const user = await User.findById(req.session.userId);
      if (!user) return res.json([]);
      const messages = await Message.find({
         $or: [
            { sender: user._id },
            { receiver: user._id }
         ],
         receiver: { $ne: null }
      }).sort({ time: -1 });
      const recentUserIds = [];
      const recentUsers = [];
      for (const msg of messages) {
         let otherId = msg.sender.equals(user._id) ? msg.receiver : msg.sender;
         if (otherId && !recentUserIds.includes(otherId.toString())) {
            recentUserIds.push(otherId.toString());
            const u = await User.findById(otherId, 'username');
            if (u) recentUsers.push(u);
         }
      }
      res.json(recentUsers);
   } catch (err) {
      res.status(500).json({ message: 'Server error' });
   }
});

app.post('/upload', upload.single('file'), async (req, res) => {
   const userId = req.body.userId;
   const user = getCurrentUser(userId);
   if (!user) {
      return res.status(400).send('User not found in chat.');
   }
   const room = req.body.room;
   if (!room) {
      return res.status(400).send('Room not found.');
   }
   let senderUser = await User.findOne({ username: user.username });
   let receiverUser = null;
   if (room && room.includes('_')) {
      const usernames = room.split('_');
      const otherUsername = usernames.find((u) => u !== user.username);
      receiverUser = await User.findOne({ username: otherUsername });
   }
   const messageDoc = new Message({
      room,
      sender: senderUser ? senderUser._id : null,
      receiver: receiverUser ? receiverUser._id : null,
      file: {
         fileName: req.file.filename,
         originalName: req.file.originalname,
         filePath: `/uploads/${req.file.filename}`,
      },
      time: new Date(),
   });
   await messageDoc.save();
   io.to(room).emit('file', {
      _id: messageDoc._id,
      username: user.username,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      time: formatMessage(user.username, 'Uploaded a file').time,
   });
   res.status(200).send({ message: 'File uploaded successfully', file: req.file });
});

app.post('/api/profile-pic', requireAuth, profilePicUpload.single('profilePic'), async (req, res) => {
   if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
   const url = `/uploads/profile/${req.file.filename}`;
   await User.findByIdAndUpdate(req.session.userId, { profilePicUrl: url });
   res.json({ url });
});

// Initialize server and socket.io
const server = http.createServer(app);
const io = socketIo(server);

// Socket.io event handlers
io.on('connection', (socket) => {
   socket.on('dashboard', () => {
      dashboardClients.add(socket);
      socket.on('disconnect', () => dashboardClients.delete(socket));
   });

   socket.on('joinRoom', ({ username, room }) => {
      const user = userJoin(socket.id, username, room);
      socket.join(user.room);
      onlineUsers[username] = true;
      io.emit('userStatus', { username, online: true });
      socket.emit('message', formatMessage(botName, 'Welcome to the ChatRoom!'));
      socket.broadcast
         .to(user.room)
         .emit('message', formatMessage(botName, `${user.username} has joined the chat!`));
      io.to(user.room).emit('roomUsers', {
         room: user.room,
         users: getRoomUsers(user.room),
      });
      socket.username = username;
   });

   socket.on('chatMessage', async (data) => {
      const user = getCurrentUser(socket.id);
      if (!user) return;
      let room = data.room;
      const msg = data.text;
      let senderUser = await User.findOne({ username: user.username });
      let receiverUser = null;
      let isPrivate = false;
      if (room && room.includes('_')) {
         isPrivate = true;
         const usernames = room.split('_');
         room = usernames.sort().join('_');
         const otherUsername = usernames.find((u) => u !== user.username);
         receiverUser = await User.findOne({ username: otherUsername });
      }
      const messageDoc = new Message({
         room,
         sender: senderUser ? senderUser._id : null,
         receiver: receiverUser ? receiverUser._id : null,
         text: msg,
         time: new Date(),
      });
      await messageDoc.save();
      io.to(room).emit('message', formatMessage(user.username, msg, messageDoc._id));
      dashboardClients.forEach((client) => {
         if (isPrivate && receiverUser && client !== socket) {
            client.emit('dashboard-notification', { type: 'private', name: receiverUser.username });
         } else if (!isPrivate && client !== socket) {
            client.emit('dashboard-notification', { type: 'group', name: room });
         }
      });
   });

   socket.on('typing', ({ room, username }) => {
      socket.to(room).emit('typing', { username });
   });
   
   socket.on('stopTyping', ({ room, username }) => {
      socket.to(room).emit('stopTyping', { username });
   });

   socket.on('messageRead', async ({ messageIds, username, room }) => {
      if (!Array.isArray(messageIds)) return;
      try {
         await Message.updateMany(
            { _id: { $in: messageIds }, room },
            { $addToSet: { readBy: username } }
         );
         messageIds.forEach(msgId => {
            io.to(room).emit('messageRead', { messageId: msgId, username });
         });
      } catch (err) {
         // Error handling
      }
   });

   socket.on('disconnect', () => {
      const user = userLeave(socket.id);
      if (user) {
         setTimeout(() => {
            const stillOnline = Object.values(io.sockets.sockets).some(s => s.username === user.username);
            if (!stillOnline) {
               onlineUsers[user.username] = false;
               io.emit('userStatus', { username: user.username, online: false });
            }
         }, 2000);
         io.to(user.room).emit(
            'message',
            formatMessage(botName, `${user.username} has left the chat!`)
         );
         io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room),
         });
      }
   });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
   console.log(`🎯 Server is running on PORT: ${PORT}`);
});
