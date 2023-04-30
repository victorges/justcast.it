require('dotenv').config()

import express, { NextFunction, Request, Response } from 'express'
import 'express-async-errors'
import cookieParser from 'cookie-parser'
import cors from 'cors'

const app = express()
app.use(cookieParser())

// must be after the call to expressWs above
import * as handlers from './handlers'

const corsOptions = {
  origin: '*',
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))

app.use('/api', handlers.api)
app.use('/', handlers.files)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ errors: [err.message] })
})

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`listening on port ${port}`)
})

module.exports = app
