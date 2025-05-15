#!/bin/bash

case "$1" in
  "start")
    docker-compose up -d
    ;;
  "stop")
    docker-compose down
    ;;
  "restart")
    docker-compose down
    docker-compose up -d
    ;;
  "logs")
    docker-compose logs -f
    ;;
  "build")
    docker-compose build
    ;;
  "clean")
    docker-compose down -v
    docker system prune -f
    ;;
  "shell")
    docker-compose exec app sh
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs|build|clean|shell}"
    exit 1
    ;;
esac
