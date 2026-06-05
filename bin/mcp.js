#!/usr/bin/env node
'use strict';

const { main } = require('../dist/cjs/mcp-server.js');

main().catch((error) => {
    console.error('bcv-exchange-rate MCP server failed to start:', error);
    process.exit(1);
});
