#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);

if (args.length > 0 || process.stdin.isTTY) {
    // CLI mode: a human invoked us (arguments given, or interactive terminal).
    // Without a command it defaults to "bcv" — the package name announces it.
    const { runCli } = require('../dist/cjs/cli.js');
    runCli(args).then((code) => process.exit(code));
} else {
    // stdin is a pipe: an MCP client (Claude, Cursor, ...) spawned us. Serve stdio.
    const { main } = require('../dist/cjs/mcp-server.js');
    main().catch((error) => {
        console.error('bcv-exchange-rate MCP server failed to start:', error);
        process.exit(1);
    });
}
