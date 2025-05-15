#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Trial Monkeys Test Suite${NC}"

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
}

# Function to run tests with coverage report
run_tests() {
    echo -e "${YELLOW}Running $1 tests...${NC}"
    docker-compose -f docker-compose.test.yml run --rm test npm run $2
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 tests completed successfully${NC}"
    else
        echo -e "${RED}✗ $1 tests failed${NC}"
        exit 1
    fi
}

# Main execution
check_docker

# Clean up existing containers
echo "Cleaning up existing test containers..."
docker-compose -f docker-compose.test.yml down -v

# Build fresh containers
echo "Building test containers..."
docker-compose -f docker-compose.test.yml build

# Run different test suites
run_tests "Unit" "test"
run_tests "Integration" "test:integration"
run_tests "End-to-End" "test:e2e"

# Generate combined coverage report
echo -e "${YELLOW}Generating coverage report...${NC}"
docker-compose -f docker-compose.test.yml run --rm test npm run coverage:report

# Clean up
echo "Cleaning up test containers..."
docker-compose -f docker-compose.test.yml down -v

echo -e "${GREEN}All tests completed successfully!${NC}"
echo "Coverage report available in ./coverage/lcov-report/index.html"
