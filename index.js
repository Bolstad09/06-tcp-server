'use strict';
require('dotenv').config();

const EventEmitter = require('events');
const net = require('net');

const uuid = require('uuid/v4');

const PORT = process.env.PORT;
const server = net.createServer();
const eventEmitter = new EventEmitter();
const socketPool = {};

let User = function (socket) {
  let id = uuid();
  this.id = id;
  this.nickname = `User-${id}`;
  this.socket = socket;
};

server.on('connection', (socket) => {
  let user = new User(socket);
  socketPool[user.id] = user;
  socket.on('data', (buffer) => dispatchAction(user.id, buffer));
  
  user.socket.write(`
  User Commands:
  - @ll <writes a message to all users>
  - @nickname <change username>
  - @list <shows a list of users>
  - @dm [username] <send a direct message to user>
  - @quit <leave the chat>
`);
});

let parse = (buffer) => {

  let text = buffer.toString().trim();
  if (!text.startsWith('@')) { return null; }
  let [command, payload] = text.split(/\s+(.*)/);
  let [target, message] = payload ? payload.split(/\s+(.*)/) : [];
  return { command, payload, target, message };

};

let dispatchAction = (userId, buffer) => {
  let entry = parse(buffer);
  entry && eventEmitter.emit(entry.command, entry, userId);
};


eventEmitter.on('@all', (data, userId) => {
  for (let connection in socketPool) {
    let user = socketPool[connection];
    user.socket.write(`<${socketPool[userId].nickname}>: ${data.payload}\n`);
  }
});

eventEmitter.on('@list', (data, userId) => {
  let listUsers = [];
  for(let key in socketPool) {
    let user = socketPool[key];
    listUsers.push('\n' + user.nickname);
  }
  socketPool[userId].socket.write(`Users: ${listUsers}\n`);
});


eventEmitter.on('@nickname', (data, userId) => {
  let nickname = socketPool[userId].nickname = data.target;
  console.log(`nickname changed to ${nickname}`);
});

eventEmitter.on('@dm', (data, userId) => {
  let findUser = data.target;
  for(let key in socketPool) {
    let user = socketPool[key];
    if(findUser === user.nickname) {
      user.socket.write(`<${socketPool[userId].nickname}>: ${data.message}\n`);
    }
  }
});

eventEmitter.on('@quit', (data, userId) => {
  let user = socketPool[userId].nickname;
  for(let key in socketPool) {
    socketPool[key].socket.write(`<${user}>: has left the chat.\n`);
  }
  socketPool[userId].socket.write(`Chat ended.\n`);
  socketPool[userId].socket.destroy();
  delete socketPool[userId];


});
server.on('error', () => {
  console.log('Error!');
});

server.listen(PORT, () => {
  console.log(`listening on PORT ${PORT}`);
});