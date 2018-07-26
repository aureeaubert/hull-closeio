const Hull = require("hull");
const express = require("express");

const server = require("./server");

const { LOG_LEVEL, SECRET, PORT } = process.env;

if (LOG_LEVEL) {
  Hull.Client.logger.transports.console.level = LOG_LEVEL;
}

Hull.Client.logger.transports.console.json = true;

const options = {
  hostSecret: SECRET || "1234",
  port: PORT || 8089
};

const app = express();
const connector = new Hull.Connector(options);

connector.setupApp(app);

server(app);
connector.startApp(app);
