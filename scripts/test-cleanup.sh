#!/usr/bin/env bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}Cleaning up test environment${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

# Stop and remove containers
echo -e "${BLUE}Stopping and removing test containers...${NC}"
docker compose -f docker-compose.test.yml down --remove-orphans 2>/dev/null || true
echo -e "${GREEN}✓ Containers removed${NC}"

# Remove volumes
echo -e "${BLUE}Removing test volumes...${NC}"
docker volume rm autopwn_postgres_test_data 2>/dev/null && echo -e "${GREEN}  ✓ Removed autopwn_postgres_test_data${NC}" || echo -e "${BLUE}  - autopwn_postgres_test_data not found${NC}"
docker volume rm autopwn_redis_test_data 2>/dev/null && echo -e "${GREEN}  ✓ Removed autopwn_redis_test_data${NC}" || echo -e "${BLUE}  - autopwn_redis_test_data not found${NC}"

# Remove network
echo -e "${BLUE}Removing test network...${NC}"
docker network rm autopwn-test-network 2>/dev/null && echo -e "${GREEN}  ✓ Removed autopwn-test-network${NC}" || echo -e "${BLUE}  - autopwn-test-network not found${NC}"

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}✓ Test environment cleanup complete${NC}"
echo -e "${GREEN}==================================================${NC}"
