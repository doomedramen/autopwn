#!/usr/bin/env bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}Cleaning up ALL autopwn test volumes${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

# Find and remove all autopwn test volumes
volumes=$(docker volume ls -q | grep -E "autopwn.*test" || true)

if [ -z "$volumes" ]; then
    echo -e "${GREEN}✓ No autopwn test volumes found${NC}"
    exit 0
fi

echo -e "${YELLOW}Found the following test volumes:${NC}"
echo "$volumes" | while read -r vol; do
    echo -e "${YELLOW}  - $vol${NC}"
done
echo ""

# Remove volumes without confirmation (for scripted cleanup)
echo -e "${BLUE}Removing volumes...${NC}"
echo "$volumes" | xargs -I {} docker volume rm {} 2>/dev/null && \
    echo -e "${GREEN}✓ All test volumes removed${NC}" || \
    echo -e "${YELLOW}⚠ Some volumes may be in use${NC}"

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo -e "${GREEN}==================================================${NC}"
