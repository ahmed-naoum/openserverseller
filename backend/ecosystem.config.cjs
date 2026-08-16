module.exports = {
    apps: [
        {
            name: 'silacod-api',
            script: 'dist/index.js',
            // Derived, not hardcoded. This previously said
            // '/var/www/silacod/backend', which does not exist on the server —
            // the checkout is at /var/www/openseller. deploy.sh:8-13 already
            // documents that these files disagreeing is a class of bug worth
            // removing; it was fixed there and missed here.
            //
            // __dirname is this file's directory, i.e. the backend root, so
            // `script: dist/index.js` and the uploads path both resolve
            // correctly wherever the repo is checked out.
            cwd: __dirname,
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
