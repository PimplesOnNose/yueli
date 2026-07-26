#!/bin/bash
# Start Yueli in the background
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Check if already running
if [ -f "yueli.pid" ]; then
    PID=$(cat yueli.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "Yueli is already running (PID $PID)"
        exit 0
    fi
    rm -f yueli.pid
fi

echo "Starting 月历 · Yueli..."
nohup node server.js > yueli.log 2>&1 &
echo $! > yueli.pid
echo "Started (PID $(cat yueli.pid))"
