// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// [START cloudrun_helloworld_service]
// [START run_helloworld_service]
require('dotenv').config()

const express = require("express");
const path = require("path");
const app = express();

const WebSocket = require("ws");
const { createStream } = require('./livepeer');

const CWD = process.cwd();

app.get("*", (req, res) => {
  const { url } = req;
  const url_segments = url.split("/");
  const url_segments_length = url_segments.length;
  const url_last_segment =
    url_segments[url_segments_length - 1] || "index.html";
  let file_name = url_last_segment;
  if (url_last_segment === "index.js") {
  } else {
    file_name = "index.html";
  }
  const file_path = path.join(CWD, "public", file_name);
  res.sendFile(file_path);
});

// app.use(express.static("public"));

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

const wss = new WebSocket.Server({
  server,
  path: "/",
});

wss.on("connection", function connection(ws, req) {
  console.error("wss", "connection", req.url);

  // createStream().then(result => console.log(result))

  function _send(data) {
    send(ws, data);
  }

  ws.on("message", function incoming(message) {
    
  });

  ws.on("close", () => {});
});

wss.on("close", function close() {
  console.log("wss", "close");
});

// [END run_helloworld_service]
// [END cloudrun_helloworld_service]

// Exports for testing purposes.
module.exports = app;
