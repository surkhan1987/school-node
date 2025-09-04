const jwt = require('jsonwebtoken')
const { Types } = require('mongoose')

module.exports = (roles = []) => {
  return (req, res, next) => {
    const token = (req.headers.authorization || ' ')?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ message: 'session_expired' })
    }

    try {
      jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
          return res.status(401).json({ message: 'session_expired' })
        }
        if (!user.branch && user.type !== 'admin') {
          return res.status(403).json({ message: 'forbidden' })
        }
        if (roles.length !== 0 && !roles.includes(user.type)) {
          return res.status(403).json({ message: 'forbidden' })
        }
        req.user = { ...user, branch: user.branch ? new Types.ObjectId(user.branch) : null }
        next()
      })
    } catch (error) {
      console.log(error)
      res.status(401).json({ message: 'session_expired' })
    }
  }
}
