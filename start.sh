#!/bin/bash

if ! command -v npm &> /dev/null
then
    echo "Install nodejs"
fi

npm install --no-audit --fund false
chmod u+x node_modules/clewd-superfetch/bin/*
node clewd.js