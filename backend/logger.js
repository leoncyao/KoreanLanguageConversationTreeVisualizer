// Logger utility that adds timestamps to all log messages

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function formatLogMessage(args) {
  const timestamp = getTimestamp();
  if (args.length === 0) return `[${timestamp}]`;
  
  // If first argument is a string, prepend timestamp
  if (typeof args[0] === 'string') {
    return [`[${timestamp}] ${args[0]}`, ...args.slice(1)];
  }
  
  // Otherwise, add timestamp as first argument
  return [`[${timestamp}]`, ...args];
}

// Override console methods to add timestamps
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

console.log = function(...args) {
  originalLog.apply(console, formatLogMessage(args));
};

console.warn = function(...args) {
  originalWarn.apply(console, formatLogMessage(args));
};

console.error = function(...args) {
  originalError.apply(console, formatLogMessage(args));
};

console.info = function(...args) {
  originalInfo.apply(console, formatLogMessage(args));
};

module.exports = { getTimestamp };

