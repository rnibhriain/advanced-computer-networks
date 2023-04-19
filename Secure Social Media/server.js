const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const {
    formatMessage,
    getMessage
 } = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  getUser,
  userLeave,
  getRoomUsers
} = require('./utils/users');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

//const key = 'keykeykeykeykeykeykeykey';
const nonce = crypto.randomBytes(12);
const aad = Buffer.from('0123456789', 'hex');

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'FrogChat Bot';

// Run when client connects
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {

    const user = userJoin(socket.id, username, room );

    socket.join(user.room);

    // Welcome current user
    socket.emit('message', formatMessage(botName, mystr = 'Welcome to Frog Chorus!',type ='decrypted', null));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`, 'decrypted', null)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);

    //encrypting messages using AES (192 bit key)
    var mykey = crypto.createCipheriv('aes-192-ccm', user.key, nonce, {
      authTagLength: 16
    });
    mykey.setAAD(aad, {
      plaintextLength: Buffer.byteLength(msg)
    });
    var mystr = mykey.update(msg,'utf8');
    mykey.final();
    var tag = mykey.getAuthTag();
    //passing encrypted message with associated tag
    io.to(user.room).emit('message', formatMessage(user.username, mystr, 'encrypted', tag));
  });

  //When check box checked, add user to group
  socket.on('add-member', mem => {
    const user = getCurrentUser(socket.id);
    if (user.username !== mem && !(user.members.includes(mem))){
      user.members.push(mem);
    }
  })

  //When check box unchecked, remove user from group
  socket.on('remove-member', mem => {
    const user = getCurrentUser(socket.id);
    if (user.username !== mem && (user.members.includes(mem))){
      for( var i = 0; i < user.members.length; i++){ 
        if ( user.members[i] === mem) { 
          user.members.splice(i, 1); 
        }
      }
    }
  })

  socket.on('decrypt-attempt', msg => {
    const message = getMessage(msg);
    const user = message.username;

    const sender = getUser(user);
    const recipient = getCurrentUser(socket.id);
    console.log("The one who sent the message: " + sender.username);
    console.log("The one trying to decrpyt: " + recipient.username);
    if(sender.members.includes(recipient.username)){
      console.log("This user can decrpyt this message")

      //decrypting message
      const decipher = crypto.createDecipheriv('aes-192-ccm', sender.key, nonce, {
        authTagLength: 16
      });
      decipher.setAuthTag(message.tag);
      decipher.setAAD(aad, {
        plaintextLength: message.text.length
      });
      const receivedPlainText = decipher.update(message.text, null, 'utf8');
      const decryptedObj = {
        text: receivedPlainText,
        id: message.id
      }
      //outputing decrypted message
      socket.emit('decrypted-message', decryptedObj);
      
    }else{
      //informing client that message cannot be decrypted
      socket.emit('message', formatMessage(botName, `You cannot decrypt ${sender.username}'s messages`, 'decrypted', null));
    }
  })

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`,'decrypted',null)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

const PORT = 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));