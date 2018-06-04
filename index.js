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
  let users = [];
  for (let connection in socketPool) {
    let currentUser = socketPool[connection];
    users.push(currentUser.nickname);
  }
  let requestingUser = socketPool[userId];
  requestingUser.socket.write(`<${'' + users}>:`);
});


eventEmitter.on('@nick', (data, userId) => {
  socketPool[userId].nickname = data.target;
});

eventEmitter.on('@dm', (data, userId) => {
  let findUser = data.target;
  for(let key in socketPool) {
    let user = socketPool[key];
    if(findUser === user.nick) {
      user.socket.write(`<${socketPool[userId].nick}>: ${data.message}\n`);
    }
  }
});

eventEmitter.on('@quit', (data, userId) => {
  let user = socketPool[userId].nick;
  for(let connection in socketPool) {
    socketPool[connection].socket.write(`<${user}>: has left.\n`);
  }
});

server.listen(PORT, () => {
  console.log(`listening on PORT ${PORT}`);
});