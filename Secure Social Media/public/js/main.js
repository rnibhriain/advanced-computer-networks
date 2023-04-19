const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});

const socket = io();

// Join chatroom
socket.emit('joinRoom', { username, room });

// Get room and users
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
});

// Message from server
socket.on('message', mystr => {
  console.log(mystr);
  
  outputMessage(mystr);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

//Decrypted message received from server
socket.on('decrypted-message', dobj =>{
  console.log(dobj.text);
  //change innerHTML to show decrpyted text
  outputDecrypted(dobj);
})

// Message submit
chatForm.addEventListener('submit', e => {
  e.preventDefault();

  // Get message text
  const msg = e.target.elements.msg.value;

  // Emit message to server
  socket.emit('chatMessage', msg);

  // Clear input
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  if(message.username == 'KeyChat Bot' || message.status == 'decrypted'){
    div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
    <p class="text"> 
      ${message.text}
    </p>`;
  } else{
    div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
    <p class="text" id=${message.id}> 
      ${message.text}
      <button class="btn-d" id=${message.username} onclick="decryptFunc(${message.id})">Decrypt</button>
    </p>`;
  }
  document.querySelector('.chat-messages').appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = `
    ${users.map(user => `<li><input type="checkbox" id=${user.username} value=${user.username} onclick="checkMember(this)"><label for=${user.username}> ${user.username}</label></li>`).join('')}
  `;
}

function checkMember(username) {
  if(username.checked == true){
    socket.emit('add-member',username.id);
  } else{
    socket.emit('remove-member',username.id);
  }
  
}

function decryptFunc(id){
  socket.emit('decrypt-attempt', id);
}

function outputDecrypted(dobj){
  const elem = document.getElementById(dobj.id);
  elem.innerHTML = `${dobj.text}`
}