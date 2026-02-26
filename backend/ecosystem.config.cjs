module.exports = {
    apps: [
        {
            name: 'openseller-api',
            script: 'dist/index.js',
            cwd: '/var/www/openseller/backend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
