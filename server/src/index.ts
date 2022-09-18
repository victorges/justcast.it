require('dotenv').config({ path: './.secrets/env' })

import express from 'express'
import cookieParser from 'cookie-parser'

const app = express()
app.use(cookieParser())

// must be after the call to expressWs above
import * as handlers from './handlers'

app.use('/api', handlers.api)
app.use('/', handlers.files)

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

module.exports = app
