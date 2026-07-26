#!/bin/bash
# Restart Yueli
cd "$(dirname "$0")"
./stop.sh
sleep 1
./start.sh
