#!/usr/bin/env bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}Cleaning up old test volumes${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

echo -e "${YELLOW}⚠️  WARNING: This will remove ALL autopwn test volumes!${NC}"
echo -e "${YELLOW}This includes orphaned volumes from previous test runs.${NC}"
echo ""

# List all autopwn test volumes
echo -e "${BLUE}Finding autopwn test volumes...${NC}"
volumes=$(docker volume ls -q | grep -E "autopwn.*test" || true)

if [ -z "$volumes" ]; then
    echo -e "${GREEN}✓ No autopwn test volumes found${NC}"
    exit 0
fi

echo -e "${BLUE}Found the following test volumes:${NC}"
echo "$volumes" | while read -r vol; do
    echo -e "${YELLOW}  - $vol${NC}"
done
echo ""

# Ask for confirmation
read -p "Do you want to remove these volumes? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Cancelled. No volumes were removed.${NC}"
    exit 0
fi

# Remove volumes
echo ""
echo -e "${BLUE}Removing volumes...${NC}"
removed_count=0
failed_count=0

echo "$volumes" | while read -r vol; do
    if docker volume rm "$vol" 2>/dev/null; then
        echo -e "${GREEN}  ✓ Removed $vol${NC}"
        removed_count=$((removed_count + 1))
    else
        echo -e "${RED}  ✗ Failed to remove $vol (may be in use)${NC}"
        failed_count=$((failed_count + 1))
    fi
done

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "${BLUE}Remaining autopwn test volumes:${NC}"
remaining=$(docker volume ls -q | grep -E "autopwn.*test" || true)
if [ -z "$remaining" ]; then
    echo -e "${GREEN}  None${NC}"
else
    echo "$remaining" | while read -r vol; do
        echo -e "${YELLOW}  - $vol${NC}"
    done
fi
