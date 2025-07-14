const moment = require('moment-timezone');

function formatMessage(username, text, messageId = null) {
   return {
      username,
      text,
      _id: messageId,
      time: moment().tz('Asia/Karachi').format('h:mm a'),
   };
}

module.exports = formatMessage;
