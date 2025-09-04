const express = require('express')
const jwt = require('jsonwebtoken')

const { User } = require('../models')

const router = express()

const generateAccessToken = (user) => {
  return jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '3h' })
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await User.findOne({ username })

  if (!user) return res.status(400).json({ message: 'invalid_credentials' })

  if (password !== user.password) return res.status(400).json({ message: 'invalid_credentials' })
  user.lastLogin = new Date()
  await user.save()
  const { password: _, ...userPayload } = JSON.parse(JSON.stringify(user))

  const accessToken = generateAccessToken(userPayload)

  res.json({ ...userPayload, accessToken })
})

module.exports = router
