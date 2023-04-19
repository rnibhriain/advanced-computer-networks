const moment = require('moment');

const messages = [];

function formatMessage(username, text, status, tag) {
  const message = {
    username,
    text,
    time: moment().format('h:mm a'),
    status,
    id: Math.floor(Math.random() * Math.floor(1000000)),
    tag
  };
  messages.push(message);
  return message;
}

function getMessage(id) {
  return messages.find(message => message.id === id);
}

module.exports = {
  formatMessage,
  getMessage
};