module.exports = {
  apps: [
    {
      name: 'school-backend',
      script: 'index.js',
      cwd: '/var/www/school-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 4050
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4050
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      exec_mode: 'cluster'
    }
  ]
};