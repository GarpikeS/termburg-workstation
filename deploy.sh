#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm run build

echo "Deploying to server..."
rsync -avz --delete build/ root@89.23.96.172:/var/www/termliny-game.ceosivaev.ru/

echo "Done! Site: https://termliny-game.ceosivaev.ru"
