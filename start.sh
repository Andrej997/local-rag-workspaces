#!/bin/bash

echo "===================================="
echo "Codebase Indexer - Docker Startup"
echo "===================================="
echo ""

echo "Starting all services with Docker Compose..."
docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 15

echo ""
echo "===================================="
echo "Services Status:"
echo "===================================="
docker-compose ps

echo ""
echo "===================================="
echo "Application URLs:"
echo "===================================="
echo "Frontend:       http://localhost"
echo "Backend API:    http://localhost:8000"
echo "API Docs:       http://localhost:8000/docs"
echo "Milvus:         localhost:19530"
echo "MinIO Console:  http://localhost:9001"
echo ""
echo "===================================="
echo "Management Commands:"
echo "===================================="
echo "View logs:      docker-compose logs -f [service-name]"
echo "Stop all:       docker-compose down"
echo "Restart:        docker-compose restart"
echo "Rebuild:        docker-compose up -d --build"
echo "===================================="
echo ""
