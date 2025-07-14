# Whatsapp-Web-App-Computer-Networks-Project
A full-stack, real-time chat application inspired by WhatsApp Web, built with Node.js, Express, MongoDB, and Socket.io. The app supports group and private messaging, file sharing, user authentication, and profile management.

Certainly! Here’s a professional, comprehensive project overview and documentation you can use for your GitHub repository. This will help others understand your project, its features, setup, and usage.

---

# whatsappWebApp

A full-stack, real-time chat application inspired by WhatsApp Web, built with Node.js, Express, MongoDB, and Socket.io. The app supports group and private messaging, file sharing, user authentication, and profile management.

---

## Features

- **User Authentication:**  
  Secure signup and login with hashed passwords and session management.

- **Profile Management:**  
  Users can upload and update their profile pictures.

- **Real-Time Messaging:**  
  - Group and private chat rooms.
  - Instant message delivery using Socket.io.
  - Typing indicators and read receipts.
  - Message editing and deletion (with file deletion).

- **File Sharing:**  
  Users can upload and share files in chats (with secure storage).

- **Group Management:**  
  - Create and delete groups (only by group creator).
  - Real-time group updates for all users.

- **User Presence:**  
  - Online/offline status tracking.
  - Dashboard notifications for new messages.

- **Recent Chats:**  
  API to fetch recent private chat contacts.

---

## Tech Stack

- **Backend:** Node.js, Express.js, Socket.io
- **Database:** MongoDB (with Mongoose ODM)
- **Authentication:** express-session, connect-mongo, bcryptjs
- **File Uploads:** multer
- **Frontend:** HTML, CSS, JavaScript (public directory)

---

## Project Structure

```
whatsappWebChat/
  ├── app.js                # Main server file (Express + Socket.io)
  ├── package.json
  ├── public/               # Frontend files (HTML, CSS, JS, images)
  │   ├── chat.html
  │   ├── dashboard.html
  │   ├── login.html
  │   ├── signup.html
  │   ├── css/
  │   ├── js/
  │   └── img/
  ├── uploads/              # Uploaded files (profile pics, chat files)
  │   └── profile/
  ├── utils/
  │   └── messages.js       # Message formatting utility
  └── README.md
```

---

## API Endpoints

### Authentication

- `POST /signup`  
  Register a new user (with profile picture upload).

- `POST /login`  
  Login with email and password.

- `POST /logout`  
  Logout and destroy session.

### User & Profile

- `GET /api/me`  
  Get current user info.

- `POST /api/profile-pic`  
  Update profile picture.

- `GET /api/users`  
  List all users (except self) with online status.

- `GET /api/userpic?username=USERNAME`  
  Get profile picture URL for a user.

### Groups

- `GET /api/groups`  
  List all groups.

- `POST /api/groups`  
  Create a new group.

- `DELETE /api/groups/:id`  
  Delete a group (only by creator).

### Messages

- `GET /api/messages?type=group&room=ROOMNAME`  
  Get all messages in a group.

- `GET /api/messages?type=private&user=USERNAME`  
  Get all private messages with a user.

- `DELETE /api/messages/:id`  
  Delete a message (only by sender).

- `PATCH /api/messages/:id`  
  Edit a message (only by sender, not for file messages).

- `POST /upload`  
  Upload a file to a chat.

### Recent Chats

- `GET /api/recent`  
  Get recent private chat contacts.

---

## Real-Time Events (Socket.io)

- `joinRoom`  
  Join a group or private chat room.

- `chatMessage`  
  Send a message to a room.

- `file`  
  Share a file in a room.

- `typing` / `stopTyping`  
  Typing indicators.

- `messageRead`  
  Mark messages as read.

- `userStatus`  
  Online/offline status updates.

- `groupCreated` / `groupDeleted`  
  Real-time group management.

- `messageEdited` / `messageDeleted`  
  Real-time message updates.

---

## Setup & Installation

1. **Clone the repository:**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start MongoDB:**  
   Make sure MongoDB is running locally on the default port.

4. **Run the server:**
   ```bash
   node app.js
   ```
   The app will run on [http://localhost:3000](http://localhost:3000).

5. **Access the app:**  
   Open your browser and go to [http://localhost:3000](http://localhost:3000).

---

## Author

- **Whatsapp Web Chat**  
  Developed by [Usman Ifty]  
  [muawan125@gmail.com | https://github.com/Usman-Ifty]

---

Let me know if you want a ready-to-use `README.md` file or want to customize any section!
