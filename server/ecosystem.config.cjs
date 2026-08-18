module.exports = {
  apps: [
    {
      name: 'kaya-api',
      script: 'src/index.js',
      cwd: __dirname,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      autorestart: true,
      watch: false,
    },
  ],
}
