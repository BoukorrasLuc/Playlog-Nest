/**

This module exports a logger object created using the Winston library for logging messages at different levels, with colorization and file storage options.
@module logger
*/

"use strict";

const winston = require("winston");

// Levels and corresponding numeric values for logging severity
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**

Determines the logging level based on the NODE_ENV environment variable. Defaults to 'development' and sets logging to 'debug' level for that environment, otherwise sets it to 'warn' level.
@returns {string} The log level to use
*/

// Colors to use for different logging levels
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "warn";
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

// Assign colors to levels
winston.addColors(colors);

// Custom formatting for log messages
const format = winston.format.combine(
  winston.format.timestamp({ format: "MM/DD/YYYY HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Transports for different destinations and log levels
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
  }),
  new winston.transports.File({
    filename: "logs/info.log",
    level: "info",
  }),
  new winston.transports.File({ filename: "logs/all.log" }),
];

// Create the logger object with the specified settings
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

module.exports = { logger };