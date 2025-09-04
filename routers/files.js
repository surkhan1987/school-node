const Router = require('express')
const router = new Router()
const multer = require('multer')
const express = require('express')
// const fs = require('fs');
const path = require('path')

const root = String(__dirname).slice(0, String(__dirname).indexOf('school-node') + 11)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(root, 'files')),
  filename: (req, file, cb) => cb(null, 'file_' + Date.now() + file.originalname.replaceAll(/.+\./g, '.'))
})

const upload = multer({ storage })
// console.log(path.join(root, 'files'))

router.use('/', express.static(path.join(root, 'files')))

router.post('/upload', upload.single('file'), (req, res) => {
  res.json({ url: '/files/' + req.file.filename })
})
// router.post('/delete', ( req, res ) => {
//   fs.unlinkSync(path.join(root, 'files', req.body.filename))
//   res.json({ message: 'success' })
// });

module.exports = router
