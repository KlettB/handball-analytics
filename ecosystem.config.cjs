module.exports = {
  apps: [
    {
      name: 'handball-statistics',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
