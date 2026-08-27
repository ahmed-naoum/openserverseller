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
        {
            // The WhatsApp agent workers. Deliberately a SECOND app rather than
            // threads inside silacod-api: that one is pinned to instances:1 with
            // max_memory_restart:'500M', and a pool of long-lived Baileys
            // sockets in that heap would be OOM-restarted mid-conversation and
            // killed on every deploy — each restart costing every connected
            // seller a reconnect.
            //
            // Still instances:1. Two of these would both try to open a socket
            // for the same number; WhatsappSession.claimToken exists to make
            // that detectable, not to make it safe.
            name: 'silacod-wa',
            script: 'dist/wa/worker.js',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            // Higher than the API's 500M because each connected WhatsApp
            // session holds its own signal state and message buffers.
            max_memory_restart: '1500M',
            // pm2 sends SIGTERM on restart; the worker closes its sockets and
            // releases its claims before exiting. Give it room to finish.
            kill_timeout: 25000,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
