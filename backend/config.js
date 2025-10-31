// Environment configuration
const config = {
  development: {
    frontend: {
      port: 3001,
      host: 'localhost'
    },
    backend: {
      port: 5001,
      host: 'localhost'
    }
  },
  production: {
    frontend: {
      port: 3000,
      host: '0.0.0.0'
    },
    backend: {
      port: 5000,
      host: '0.0.0.0'
    }
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];


