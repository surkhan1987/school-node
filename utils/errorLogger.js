// const axios = require("axios");
// const {BOT_TOKEN, TELEGRAM_ID} = require("../env");
module.exports = (req, res, e, path) => {
  console.error('+++++++++++++++++++++++++++++++++++++++++++++++++++++++')
  console.error('path: ' + path)
  console.error('req.body ', req.body)
  console.error('e ', e)
  res.status(500).json(e)

//     axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
//         {
//             chat_id: TELEGRAM_ID,
//             parse_mode: 'HTML',
//             text: `🛑 <b>#ERROR</b>
//
// <b>REQUEST BODY:</b> ${JSON.stringify(req.body, null, 2)}
//
// <b>PATH:</b> ${path}
//
// <b>ERROR:</b> ${JSON.stringify(e, null, 2)}`
//         }
//     )
//         .then(() => console.log('botga ketti', e.code))
//         .catch(e => console.log('botga ketmadi', e.code))
}
