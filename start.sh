#!/bin/bash

if ! command -v npm &> /dev/null
then
    echo "Install nodejs first"
fi

npm install --no-audit --fund false
node clewd.js