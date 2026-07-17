module.exports = {
  apps: [
    {
      name: 'icu-payment-api',
      cwd: __dirname,
      script: 'src/app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
    },
  ],
};
