if (!window.socket) {
  window.socket = io();
}
var socket = window.socket;
let currentRoom = null;
let chatForm, chatMessages, roomName, userList;

var fileInput = null;
var uploadedFileContainer = null;
var selectedFileName = null;

let typingTimeout = null;
let isTyping = false;
let typingIndicator = null;

// Assign DOM elements after DOMContentLoaded

document.addEventListener('DOMContentLoaded', function () {
   chatForm = document.getElementById('chat-form');
   chatMessages = document.querySelector('.chat-messages');
   roomName = document.getElementById('room-name');
   userList = document.getElementById('users');

   fileInput = document.getElementById('file-input');
   uploadedFileContainer = document.getElementById('uploaded-file-container');
   selectedFileName = document.getElementById('selected-file-name');

   const addFileButton = document.getElementById('add-file-button');
   const fileOptions = document.querySelector('.file-options');
   const emojiButton = document.getElementById('emoji-button');
   const emojiPickerContainer = document.getElementById('emoji-picker-container');

   // Initialize emoji picker
   let emojiPicker = null;
   if (emojiButton && emojiPickerContainer) {
      // Check if EmojiMart is available
      if (window.EmojiMart) {
         emojiPicker = new EmojiMart.Picker({
            onEmojiSelect: (emoji) => {
               const msgInput = document.getElementById('msg');
               const cursorPos = msgInput.selectionStart;
               const textBefore = msgInput.value.substring(0, cursorPos);
               const textAfter = msgInput.value.substring(cursorPos);
               msgInput.value = textBefore + emoji.native + textAfter;
               msgInput.focus();
               msgInput.setSelectionRange(cursorPos + emoji.native.length, cursorPos + emoji.native.length);
               // Don't close the picker - let user select multiple emojis
            },
            theme: document.body.classList.contains('dark-mode') ? 'dark' : 'light',
            set: 'native',
            showPreview: false,
            showSkinTones: true,
            emojiSize: 20,
            perLine: 8
         });
         emojiPickerContainer.appendChild(emojiPicker);
      } else {
         // Fallback: simple emoji button that shows common emojis
         emojiButton.addEventListener('click', function() {
            const commonEmojis = ['😀', '😂', '😍', '😎', '😭', '😡', '🤔', '👍', '👎', '❤️', '💔', '🎉', '🔥', '💯', '👏', '🙏', '😊', '😢', '😴', '🤗'];
            const emojiGrid = document.createElement('div');
            emojiGrid.style.cssText = `
               position: absolute;
               bottom: 100%;
               right: 0;
               background: white;
               border: 1px solid #ddd;
               border-radius: 8px;
               padding: 10px;
               display: grid;
               grid-template-columns: repeat(5, 1fr);
               gap: 5px;
               z-index: 1000;
               box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            `;
            
            commonEmojis.forEach(emoji => {
               const emojiBtn = document.createElement('button');
               emojiBtn.textContent = emoji;
               emojiBtn.style.cssText = `
                  background: none;
                  border: none;
                  font-size: 20px;
                  cursor: pointer;
                  padding: 5px;
                  border-radius: 4px;
                  transition: background 0.2s;
               `;
               emojiBtn.onmouseover = () => emojiBtn.style.background = '#f0f0f0';
               emojiBtn.onmouseout = () => emojiBtn.style.background = 'none';
               emojiBtn.onclick = () => {
                  const msgInput = document.getElementById('msg');
                  const cursorPos = msgInput.selectionStart;
                  const textBefore = msgInput.value.substring(0, cursorPos);
                  const textAfter = msgInput.value.substring(cursorPos);
                  msgInput.value = textBefore + emoji + textAfter;
                  msgInput.focus();
                  msgInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
                  // Don't close the picker - let user select multiple emojis
               };
               emojiGrid.appendChild(emojiBtn);
            });
            
            emojiPickerContainer.appendChild(emojiGrid);
            emojiPickerContainer.classList.remove('hidden');
         });
      }
   }

   // Toggle emoji picker (only for EmojiMart version)
   if (emojiButton && emojiPickerContainer && window.EmojiMart) {
      emojiButton.addEventListener('click', function () {
         emojiPickerContainer.classList.toggle('hidden');
         if (!emojiPickerContainer.classList.contains('hidden')) {
            emojiPickerContainer.style.display = 'block';
         }
      });
   }

   // Toggle file options dropdown
   if (addFileButton && fileOptions) {
      addFileButton.addEventListener('click', function () {
         fileOptions.classList.toggle('hidden');
         // Hide emoji picker when file options are opened
         if (emojiPickerContainer) {
            emojiPickerContainer.classList.add('hidden');
            emojiPickerContainer.style.display = 'none';
            // Also remove any fallback emoji grids
            const fallbackGrids = emojiPickerContainer.querySelectorAll('div[style*="grid-template-columns"]');
            fallbackGrids.forEach(grid => grid.remove());
         }
      });
   }

   // Set file input behavior for pictures
   const uploadPictureBtn = document.getElementById('upload-picture');
   if (uploadPictureBtn) {
      uploadPictureBtn.addEventListener('click', function () {
         configureFileInput('image/*');
      });
   }

   // Set file input behavior for any file
   const uploadFileBtn = document.getElementById('upload-file');
   if (uploadFileBtn) {
      uploadFileBtn.addEventListener('click', function () {
         configureFileInput('');
      });
   }

   // Configure file input accept type and trigger click
   function configureFileInput(acceptType) {
      fileInput.accept = acceptType;
      fileInput.click(); // Simulate input click
      if (fileOptions) fileOptions.classList.add('hidden'); // Hide options dropdown
   }

   // Handle file input changes
   if (fileInput) {
      fileInput.addEventListener('change', function () {
         const file = fileInput.files[0];
         if (file) {
            displayUploadedFile(file);
            selectedFileName.textContent = file.name;
         } else {
            selectedFileName.textContent = '';
         }
      });
   }

   // Handle "Send" button click
   const sendButton = document.querySelector('.send-button');
   if (sendButton) {
      sendButton.addEventListener('click', async function (e) {
         e.preventDefault();
         const sendBtn = this;
         sendBtn.disabled = true;
         sendBtn.innerHTML = '<span class="spinner" style="margin-right:8px;">⏳</span>Sending...';
         const file = fileInput.files[0];
         try {
            if (file) {
               await sendFile(file);
               clearFileInput(); // Clear file input after sending
               selectedFileName.textContent = '';
            } else {
               await sendMessage();
            }
         } catch (err) {
            showNotification('Failed to send message or file.', true);
         } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
         }
      });
   }

   // Prevent Enter key from submitting form by default
   if (chatForm) {
      chatForm.addEventListener('keypress', function (e) {
         if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
         }
      });
   }

   // Hide emoji picker when clicking outside
   document.addEventListener('click', function (e) {
      if (emojiPickerContainer && !emojiPickerContainer.contains(e.target) && !emojiButton.contains(e.target)) {
         emojiPickerContainer.classList.add('hidden');
         emojiPickerContainer.style.display = 'none';
         // Also remove any fallback emoji grids
         const fallbackGrids = emojiPickerContainer.querySelectorAll('div[style*="grid-template-columns"]');
         fallbackGrids.forEach(grid => grid.remove());
      }
   });

   // Hide emoji picker when pressing Escape
   document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && emojiPickerContainer) {
         emojiPickerContainer.classList.add('hidden');
         emojiPickerContainer.style.display = 'none';
         // Also remove any fallback emoji grids
         const fallbackGrids = emojiPickerContainer.querySelectorAll('div[style*="grid-template-columns"]');
         fallbackGrids.forEach(grid => grid.remove());
      }
   });
});

// Send a text message
async function sendMessage() {
   const msgInput = document.getElementById('msg');
   const msg = msgInput.value.trim();
   if (msg !== '' && currentRoom) {
      try {
         socket.emit('chatMessage', { room: currentRoom, text: msg });
         msgInput.value = '';
         msgInput.focus();
         showNotification('Message sent');
         // Hide emoji picker after sending message
         const emojiPickerContainer = document.getElementById('emoji-picker-container');
         if (emojiPickerContainer) {
            emojiPickerContainer.classList.add('hidden');
            emojiPickerContainer.style.display = 'none';
            // Also remove any fallback emoji grids
            const fallbackGrids = emojiPickerContainer.querySelectorAll('div[style*="grid-template-columns"]');
            fallbackGrids.forEach(grid => grid.remove());
         }
      } catch (err) {
         showNotification('Failed to send message.', true);
      }
   }
}

// Send a file to the server
async function sendFile(file) {
   const formData = new FormData();
   formData.append('file', file);
   formData.append('userId', socket.id);
   formData.append('room', currentRoom);
   try {
      const response = await fetch('/upload', {
         method: 'POST',
         body: formData,
      });
      const data = await response.json();
      if (response.ok && data.message) {
         showNotification('File uploaded successfully');
      } else {
         showNotification(data.message || 'File upload failed.', true);
         throw new Error(data.message || 'File upload failed.');
      }
   } catch (error) {
      showNotification('Error uploading file.', true);
      throw error;
   }
}

// Display file preview
function displayUploadedFile(file) {
   const fileReader = new FileReader();

   fileReader.onload = function () {
      const fileURL = fileReader.result;
      const fileType = file.type;

      let filePreview = '';
      if (fileType.startsWith('image')) {
         filePreview = `<img src="${fileURL}" alt="Uploaded Image" style="max-width: 100%; border: 2px solid #007bff; border-radius: 5px;">`;
      } else {
         filePreview = `<p style="color: #007bff; font-weight: bold;">${file.name}</p>`;
      }

      uploadedFileContainer.innerHTML = filePreview;
   };

   fileReader.readAsDataURL(file); // Read the file
}

// Clear file input field
function clearFileInput() {
   fileInput.value = ''; // Reset file input
   uploadedFileContainer.innerHTML = ''; // Clear preview
   if (selectedFileName) selectedFileName.textContent = '';
}

// Helper: Get current user info from server
async function getCurrentUser() {
   const res = await fetch('/api/me');
   if (res.status === 401) {
      window.location.href = 'login.html';
      return null;
   }
   return await res.json();
}

// Helper: Get user profile pic by username
async function getUserProfilePic(username) {
   if (!window._userPicCache) window._userPicCache = {};
   if (window._userPicCache[username]) return window._userPicCache[username];
   const res = await fetch(`/api/userpic?username=${encodeURIComponent(username)}`);
   if (res.ok) {
      const data = await res.json();
      window._userPicCache[username] = data.url;
      return data.url;
   }
   return 'img/icons8-chat-64.png';
}

// Login form submission
if (document.getElementById('login-form')) {
   document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errorDiv = document.getElementById('login-error');
      errorDiv.textContent = '';
      try {
         const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
         });
         const data = await res.json();
         if (res.ok) {
            window.location.href = 'dashboard.html';
         } else {
            errorDiv.textContent = data.message || 'Login failed.';
         }
      } catch (err) {
         errorDiv.textContent = 'Server error.';
      }
   });
}

// Signup form submission
if (document.getElementById('signup-form')) {
   document.getElementById('signup-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('signup-email').value.trim();
      const username = document.getElementById('signup-username').value.trim();
      const password = document.getElementById('signup-password').value;
      const errorDiv = document.getElementById('signup-error');
      errorDiv.textContent = '';
      const formData = new FormData();
      formData.append('email', email);
      formData.append('username', username);
      formData.append('password', password);
      const profilePicInput = document.getElementById('signup-profile-pic-input');
      if (profilePicInput && profilePicInput.files[0]) {
         formData.append('profilePic', profilePicInput.files[0]);
      }
      try {
         const res = await fetch('/signup', {
            method: 'POST',
            body: formData
         });
         const data = await res.json();
         if (res.ok) {
            window.location.href = 'login.html';
         } else {
            errorDiv.textContent = data.message || 'Signup failed.';
         }
      } catch (err) {
         errorDiv.textContent = 'Server error.';
      }
   });
}

// Helper: Render online status dot
function onlineDot(isOnline) {
  return `<span class="online-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle;background:${isOnline ? '#25d366' : '#bbb'};"></span>`;
}

// Dashboard data fetch
if (document.getElementById('user-list')) {
   async function fetchDashboardData() {
      const userList = document.getElementById('user-list');
      const groupList = document.getElementById('group-list');
      const recentList = document.getElementById('recent-list');
      userList.innerHTML = '<li>Loading...</li>';
      groupList.innerHTML = '<li>Loading...</li>';
      recentList.innerHTML = '<li>Loading...</li>';
      try {
         const [usersRes, groupsRes, recentRes] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/groups'),
            fetch('/api/recent')
         ]);
         const users = await usersRes.json();
         const groups = await groupsRes.json();
         const recent = await recentRes.json();
         recentList.innerHTML = recent.length ? recent.map(u => `<li><a href="chat.html?type=private&user=${encodeURIComponent(u.username)}" data-username="${u.username}">${onlineDot(u.online)}${u.username}<span class="badge" id="badge-user-${u.username}"></span></a></li>`).join('') : '<li>No recent chats</li>';
         userList.innerHTML = users.map(u => `<li><a href="chat.html?type=private&user=${encodeURIComponent(u.username)}" data-username="${u.username}">${onlineDot(u.online)}${u.username}<span class="badge" id="badge-user-${u.username}"></span></a></li>`).join('') || '<li>No users found</li>';
         groupList.innerHTML = groups.map(g => `<li><a href="chat.html?type=group&room=${encodeURIComponent(g.name)}" data-group="${g.name}">${g.name}<span class="badge" id="badge-group-${g.name}"></span></a></li>`).join('') || '<li>No groups found</li>';
         showNotification('Dashboard data loaded');
      } catch (err) {
         showNotification('Error loading dashboard data.', true);
         userList.innerHTML = '<li>Error loading users</li>';
         groupList.innerHTML = '<li>Error loading groups</li>';
         recentList.innerHTML = '<li>Error loading recent chats</li>';
      }
   }
   fetchDashboardData();

   // Listen for real-time userStatus updates
   if (window.socket) {
     window.socket.on('userStatus', ({ username, online }) => {
       // Update all user links with this username
       document.querySelectorAll(`a[data-username='${username}']`).forEach(a => {
         const dot = a.querySelector('.online-dot');
         if (dot) dot.style.background = online ? '#25d366' : '#bbb';
         else a.insertAdjacentHTML('afterbegin', onlineDot(online));
       });
     });
   }
}

// Sidebar user info and profile pic
if (document.getElementById('sidebar-username')) {
   fetch('/api/me').then(res => res.json()).then(user => {
      document.getElementById('sidebar-username').textContent = user.username;
      document.getElementById('sidebar-email').textContent = user.email;
      if (user.profilePicUrl && document.getElementById('profile-pic-sidebar')) {
         document.getElementById('profile-pic-sidebar').style.backgroundImage = `url('${user.profilePicUrl}')`;
      }
   });
}

// Profile pic upload
if (document.getElementById('profile-pic-input')) {
   const profilePicInput = document.getElementById('profile-pic-input');
   const profilePicSidebar = document.getElementById('profile-pic-sidebar');
   profilePicInput.addEventListener('change', async function() {
      const formData = new FormData();
      formData.append('profilePic', profilePicInput.files[0]);
      const res = await fetch('/api/profile-pic', {
         method: 'POST',
         body: formData
      });
      const data = await res.json();
      if (data.url) {
         profilePicSidebar.style.backgroundImage = `url('${data.url}')`;
      }
   });
}

// Add logout button to sidebar if present
if (document.querySelector('.sidebar')) {
   const logoutBtn = document.createElement('button');
   logoutBtn.textContent = 'Logout';
   logoutBtn.className = 'btn';
   logoutBtn.style.marginTop = '16px';
   logoutBtn.onclick = function() {
      // Call logout endpoint and redirect
      fetch('/logout', { method: 'POST' }).then(() => {
         window.location.href = 'login.html';
      });
   };
   document.querySelector('.sidebar').appendChild(logoutBtn);
}

// --- Read Receipts ---
// Helper: Render read/delivered checkmarks
function readCheck(isRead) {
  return `<span class="read-check" style="font-size:1.1em;margin-left:6px;color:${isRead ? '#25d366' : '#bbb'};">${isRead ? '✓✓' : '✓'}</span>`;
}

// Track message elements by ID for updating read status
const messageElements = {};

// Remove read receipt logic from chat history loading
// On page load, determine chat type and set up chat
(async function () {
   const params = Qs.parse(location.search, { ignoreQueryPrefix: true });
   const currentUser = await getCurrentUser();
   if (!currentUser) return;
   window._currentUsername = currentUser.username;

   let chatType = params.type;
   let chatTarget = chatType === 'private' ? params.user : params.room;
   if (!chatType || !chatTarget) {
      window.location.href = 'dashboard.html';
      return;
   }

   // Set chat header
   if (roomName) {
      if (chatType === 'private') {
         roomName.textContent = `Chat with ${chatTarget}`;
      } else {
         roomName.textContent = chatTarget;
      }
   }

   // Fetch and display chat history
   let historyUrl = `/api/messages?type=${chatType}`;
   if (chatType === 'private') historyUrl += `&user=${encodeURIComponent(chatTarget)}`;
   else historyUrl += `&room=${encodeURIComponent(chatTarget)}`;
   try {
      const res = await fetch(historyUrl);
      if (res.ok) {
         const messages = await res.json();
         messages.forEach(msg => {
            if (msg.file && msg.file.filePath) {
               // File message
               displayReceivedFile({
                  _id: msg._id,
                  username: msg.sender?.username || 'Unknown',
                  fileName: msg.file.fileName,
                  originalName: msg.file.originalName,
                  filePath: msg.file.filePath,
                  time: new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
               });
            } else {
               // Text message
               outputMessage({
                  _id: msg._id,
                  username: msg.sender?.username || 'Unknown',
                  text: msg.text,
                  time: new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  edited: msg.edited
               });
            }
         });
         scrollToBottom(); // Ensure scroll after loading history
      }
   } catch (err) {
      showNotification('Error loading chat history.', true);
   }

   // Join room or private chat
   if (chatType === 'group') {
      currentRoom = chatTarget;
      socket.emit('joinRoom', { username: currentUser.username, room: chatTarget });
   } else {
      // For private chat, use a unique room name based on both usernames
      const privateRoom = [currentUser.username, chatTarget].sort().join('_');
      currentRoom = privateRoom;
      socket.emit('joinRoom', { username: currentUser.username, room: privateRoom });
   }

   // Listen for messages
   socket.on('message', (message) => {
      outputMessage(message);
      scrollToBottom();
      markUnread();
      // Push notification for text message
      if (!windowFocused && message.username && message.text) {
         showPushNotification('New message', `${message.username}: ${message.text}`);
      }
   });

   // Listen for files
   socket.on('file', (fileData) => {
      displayReceivedFile(fileData);
      scrollToBottom();
      markUnread();
      // Push notification for file
      if (!windowFocused && fileData.username && fileData.originalName) {
         showPushNotification('New file', `${fileData.username}: ${fileData.originalName}`);
      }
   });

   // Update user list for group chats
   socket.on('roomUsers', ({ room, users }) => {
      if (chatType === 'group') outputUsers(users);
   });
})();

// --- Message Editing/Undo ---
// Inline edit handler
function enableEditMessage(div, msgId, oldText) {
  const textP = div.querySelector('.text');
  const metaP = div.querySelector('.meta');
  if (!textP || !metaP) return;
  // Replace text with input
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldText;
  input.style.width = '90%';
  input.style.fontSize = '1em';
  input.style.margin = '4px 0';
  textP.replaceWith(input);
  // Add save/cancel buttons
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'btn';
  saveBtn.style.marginLeft = '8px';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn';
  cancelBtn.style.background = '#eee';
  cancelBtn.style.color = '#333';
  cancelBtn.style.marginLeft = '8px';
  metaP.appendChild(saveBtn);
  metaP.appendChild(cancelBtn);
  // Save handler
  saveBtn.onclick = async function() {
    const newText = input.value.trim();
    if (!newText) return showNotification('Message cannot be empty', true);
    saveBtn.disabled = true;
    try {
      const res = await fetch(`/api/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('Message edited');
        // Clean up the editing UI immediately
        const newTextP = document.createElement('p');
        newTextP.className = 'text';
        newTextP.textContent = newText;
        input.replaceWith(newTextP);
        saveBtn.remove();
        cancelBtn.remove();
      } else {
        showNotification(data.message || 'Edit failed', true);
        saveBtn.disabled = false;
      }
    } catch (err) {
      showNotification('Server error', true);
      saveBtn.disabled = false;
    }
  };
  // Cancel handler
  cancelBtn.onclick = function() {
    // Restore original text
    input.replaceWith(textP);
    saveBtn.remove();
    cancelBtn.remove();
  };
}

// Listen for edit button clicks (event delegation)
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('edit-msg-btn')) {
    const msgId = e.target.getAttribute('data-id');
    const div = document.querySelector(`.message[data-msg-id='${msgId}']`);
    if (!div) return;
    const textP = div.querySelector('.text');
    if (!textP) return;
    enableEditMessage(div, msgId, textP.textContent.replace(' (edited)', ''));
  }
});

// Listen for real-time message edits
if (window.socket) {
  socket.on('messageEdited', ({ _id, text, edited, editedAt }) => {
    const div = messageElements[_id];
    if (div) {
      const textP = div.querySelector('.text');
      if (textP) {
        textP.textContent = text + (edited ? ' (edited)' : '');
      }
      // Add (edited) to meta if not present
      const metaP = div.querySelector('.meta');
      if (metaP && edited && !metaP.textContent.includes('(edited)')) {
        metaP.innerHTML += ' <span style="color:#888;font-size:0.95em;">(edited)</span>';
      }
    }
  });
  
  // Listen for real-time message deletions
  socket.on('messageDeleted', ({ _id }) => {
    const div = messageElements[_id];
    if (div) {
      // Replace the message content with "This message was deleted"
      const textP = div.querySelector('.text');
      if (textP) {
        textP.textContent = 'This message was deleted';
        textP.style.color = '#888';
        textP.style.fontStyle = 'italic';
      }
      // Remove edit and delete buttons
      const editBtn = div.querySelector('.edit-msg-btn');
      const deleteBtn = div.querySelector('.delete-msg-btn');
      if (editBtn) editBtn.remove();
      if (deleteBtn) deleteBtn.remove();
    }
  });
}

// Remove read receipt logic from outputMessage
// --- Message Rendering ---
async function outputMessage(message) {
   console.log('outputMessage:', message); // Debug log
   const div = document.createElement('div');
   div.classList.add('message');
   const currentUser = (await getCurrentUser()).username;
   let isSent = message.username === currentUser;
   let isEdited = message.edited;
   if (isSent) {
      div.classList.add('sent');
      // Add delete and edit buttons, and (edited) label
      div.innerHTML = `
        <div class="msg-avatar" style="background-image:url('${await getUserProfilePic(message.username)}')"></div>
        <div class="msg-content">
          <p class="meta">${message.username} <span>${message.time}</span>
            ${message._id ? `<button class="delete-msg-btn" data-id="${message._id}" title="Delete" style="background:none;border:none;color:#d9534f;cursor:pointer;font-size:1.1em;margin-left:8px;">🗑️</button>` : ''}
            ${message._id ? `<button class="edit-msg-btn" data-id="${message._id}" title="Edit" style="background:none;border:none;color:#3f72af;cursor:pointer;font-size:1.1em;margin-left:4px;">✏️</button>` : ''}
            ${isEdited ? '<span style="color:#888;font-size:0.95em;">(edited)</span>' : ''}
          </p>
          <p class="text">${message.text}</p>
        </div>
      `;
   } else {
      div.classList.add('received');
      div.innerHTML = `
        <div class="msg-avatar" style="background-image:url('${await getUserProfilePic(message.username)}')"></div>
        <div class="msg-content">
          <p class="meta">${message.username} <span>${message.time}</span>${isEdited ? ' <span style="color:#888;font-size:0.95em;">(edited)</span>' : ''}</p>
          <p class="text">${message.text}</p>
        </div>
      `;
   }
   if (message._id) {
     div.setAttribute('data-msg-id', message._id);
     messageElements[message._id] = div;
   }
   chatMessages.appendChild(div);
   scrollToBottom(); // Always scroll after appending
}

async function displayReceivedFile(fileData) {
   console.log('displayReceivedFile:', fileData); // Debug log
   const div = document.createElement('div');
   div.classList.add('message');
   const currentUser = (await getCurrentUser()).username;
   let isSent = fileData.username === currentUser;
   if (isSent) {
      div.classList.add('sent');
      // Add delete button
      div.innerHTML = `
        <div class="msg-avatar" style="background-image:url('${await getUserProfilePic(fileData.username)}')"></div>
        <div class="msg-content">
          <p class="meta">${fileData.username} <span>${fileData.time}</span>
            ${fileData._id ? `<button class="delete-msg-btn" data-id="${fileData._id}" title="Delete" style="background:none;border:none;color:#d9534f;cursor:pointer;font-size:1.1em;margin-left:8px;">🗑️</button>` : ''}
          </p>
          <p class="text">
            <a href="${fileData.filePath}" target="_blank" style="color: #007bff; font-weight: bold;">${fileData.originalName}</a>
          </p>
        </div>
      `;
   } else {
      div.innerHTML = `
        <div class="msg-avatar" style="background-image:url('${await getUserProfilePic(fileData.username)}')"></div>
        <div class="msg-content">
          <p class="meta">${fileData.username} <span>${fileData.time}</span></p>
          <p class="text">
            <a href="${fileData.filePath}" target="_blank" style="color: #007bff; font-weight: bold;">${fileData.originalName}</a>
          </p>
        </div>
      `;
   }
   if (fileData._id) {
     div.setAttribute('data-msg-id', fileData._id);
     messageElements[fileData._id] = div;
   }
   chatMessages.appendChild(div);
   scrollToBottom(); // Always scroll after appending
}

// Set room name
function outputRoomName(room) {
   roomName.innerHTML = room;
}

// Add users to user list (chat sidebar)
function outputUsers(users) {
   userList.innerHTML = users.map((user) => `<li>${onlineDot(user.online)}${user.username}</li>`).join('');
}

// Scroll chat to bottom
function scrollToBottom() {
   chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Notification helpers
let windowFocused = true;
window.onfocus = () => { windowFocused = true; clearUnread(); };
window.onblur = () => { windowFocused = false; };

// Add audio element for sound notifications
const notificationAudio = document.createElement('audio');
notificationAudio.src = 'https://notificationsounds.com/storage/sounds/file-sounds-1152-pristine.mp3';
notificationAudio.preload = 'auto';
document.body.appendChild(notificationAudio);

// Request browser notification permission
if ('Notification' in window && Notification.permission !== 'granted') {
   Notification.requestPermission();
}

function markUnread() {
   if (!windowFocused) {
      const lastMsg = document.querySelector('.chat-messages .message:last-child');
      if (lastMsg) lastMsg.classList.add('unread');
      document.title = '(New) Whatsapp Web application';
      notificationAudio.currentTime = 0;
      notificationAudio.play();
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
         let lastMsgText = lastMsg?.querySelector('.text')?.textContent || 'New message';
         let lastMsgUser = lastMsg?.querySelector('.meta')?.textContent.split(' ')[0] || 'Someone';
         new Notification('Whatsapp Web application', {
            body: `${lastMsgUser}: ${lastMsgText}`,
            icon: 'img/icons8-chat-64.png'
         });
      }
   }
}
function clearUnread() {
   document.title = 'Whatsapp Web application';
   document.querySelectorAll('.chat-messages .message.unread').forEach(m => m.classList.remove('unread'));
}

// --- Push Notifications for New Messages ---
function showPushNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: 'img/icons8-chat-64.png'
    });
    notification.onclick = function() {
      window.focus();
      this.close();
    };
  }
}

// Ensure permission is requested on load
if ('Notification' in window && Notification.permission !== 'granted') {
  Notification.requestPermission();
}

// Add dark mode toggle button to all pages
function addDarkModeToggle() {
   const btn = document.createElement('button');
   btn.textContent = '🌙';
   btn.title = 'Toggle dark mode';
   btn.style.position = 'fixed';
   btn.style.top = '18px';
   btn.style.right = '18px';
   btn.style.zIndex = 1000;
   btn.style.background = '#25d366';
   btn.style.color = '#181c1f';
   btn.style.border = 'none';
   btn.style.borderRadius = '50%';
   btn.style.width = '40px';
   btn.style.height = '40px';
   btn.style.fontSize = '1.3em';
   btn.style.cursor = 'pointer';
   btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
   btn.style.transition = 'background 0.2s, color 0.2s';
   btn.onclick = function() {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
      btn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
      
      // Update emoji picker theme if it exists
      const emojiPickerContainer = document.getElementById('emoji-picker-container');
      if (emojiPickerContainer && emojiPickerContainer.querySelector('.emoji-mart')) {
         const isDarkMode = document.body.classList.contains('dark-mode');
         emojiPickerContainer.querySelector('.emoji-mart').setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
      }
   };
   document.body.appendChild(btn);
   // Set initial state
   if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      btn.textContent = '☀️';
   }
}
window.addEventListener('DOMContentLoaded', addDarkModeToggle);

// Add spinner CSS (if not present)
if (!document.getElementById('global-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'global-spinner-style';
  style.textContent = `.spinner { display: inline-block; animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

// Add online-dot CSS if not present
if (!document.getElementById('online-dot-style')) {
  const style = document.createElement('style');
  style.id = 'online-dot-style';
  style.textContent = `.online-dot { box-shadow: 0 0 4px #25d36655; transition: background 0.2s; }`;
  document.head.appendChild(style);
}

// Add typing-indicator CSS if not present
if (!document.getElementById('typing-indicator-style')) {
  const style = document.createElement('style');
  style.id = 'typing-indicator-style';
  style.textContent = `.typing-indicator { animation: typingFade 1.2s infinite alternate; } @keyframes typingFade { from { opacity: 0.7; } to { opacity: 1; } }`;
  document.head.appendChild(style);
}

// Add typing indicator to chat UI
function showTypingIndicator(username) {
  if (!typingIndicator) {
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.margin = '8px 0 8px 0';
    typingIndicator.style.color = '#3f72af';
    typingIndicator.style.fontStyle = 'italic';
    typingIndicator.style.fontSize = '1em';
    typingIndicator.textContent = `${username} is typing...`;
    chatMessages.appendChild(typingIndicator);
    scrollToBottom();
  } else {
    typingIndicator.textContent = `${username} is typing...`;
  }
}
function hideTypingIndicator() {
  if (typingIndicator && typingIndicator.parentNode) {
    typingIndicator.parentNode.removeChild(typingIndicator);
    typingIndicator = null;
  }
}

// Emit typing events as user types
if (document.getElementById('msg')) {
  const msgInput = document.getElementById('msg');
  msgInput.addEventListener('input', function() {
    if (!isTyping && currentRoom) {
      isTyping = true;
      socket.emit('typing', { room: currentRoom, username: window._currentUsername });
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit('stopTyping', { room: currentRoom, username: window._currentUsername });
    }, 1200);
  });
}

// Listen for typing events from others
if (window.socket) {
  socket.on('typing', ({ username }) => {
    if (window._currentUsername && username !== window._currentUsername) {
      showTypingIndicator(username);
    }
  });
  socket.on('stopTyping', ({ username }) => {
    if (window._currentUsername && username !== window._currentUsername) {
      hideTypingIndicator();
    }
  });
}

// Store current username globally for typing indicator
(async function() {
  const user = await getCurrentUser();
  if (user && user.username) window._currentUsername = user.username;
})();

// Listen for delete button clicks (event delegation)
document.addEventListener('click', async function(e) {
  if (e.target.classList.contains('delete-msg-btn')) {
    const msgId = e.target.getAttribute('data-id');
    if (!msgId) return;
    if (!confirm('Delete this message?')) return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = '⏳';
    try {
      const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        // Remove the message from the chat
        const msgDiv = document.querySelector(`.message[data-msg-id='${msgId}']`);
        if (msgDiv) msgDiv.remove();
        showNotification('Message deleted');
      } else {
        showNotification(data.message || 'Delete failed', true);
      }
    } catch (err) {
      showNotification('Server/network error while deleting.', true);
    } finally {
      btn.disabled = false;
      btn.textContent = '🗑️';
    }
  }
});

// Add showNotification function (toast style)
function showNotification(msg, isError) {
  let notif = document.createElement('div');
  notif.textContent = msg;
  notif.style.position = 'fixed';
  notif.style.bottom = '32px';
  notif.style.right = '32px';
  notif.style.background = isError ? '#d9534f' : '#25d366';
  notif.style.color = '#fff';
  notif.style.padding = '12px 24px';
  notif.style.borderRadius = '8px';
  notif.style.fontSize = '1.08em';
  notif.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
  notif.style.zIndex = 9999;
  notif.style.opacity = 0.95;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 2000);
}

// Add read-check CSS if not present
if (!document.getElementById('read-check-style')) {
  const style = document.createElement('style');
  style.id = 'read-check-style';
  style.textContent = `.read-check { font-weight: bold; transition: color 0.2s; }`;
  document.head.appendChild(style);
}
