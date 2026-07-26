#!/bin/bash
# Stop Yueli
cd "$(dirname "$0")"

if [ ! -f "yueli.pid" ]; then
    echo "Yueli is not running (no PID file)"
    exit 0
fi

PID=$(cat yueli.pid)
if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping Yueli (PID $PID)..."
    kill "$PID"
    rm -f yueli.pid
    echo "Stopped"
else
    echo "Yueli is not running (stale PID file)"
    rm -f yueli.pid
fi
