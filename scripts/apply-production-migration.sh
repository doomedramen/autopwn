#!/bin/bash

# Production migration script for adding missing 'name' column to jobs table
# Usage: ./scripts/apply-production-migration.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Production Migration Script${NC}"
echo "=================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set it to your production database connection string"
    exit 1
fi

echo -e "${YELLOW}Database URL detected${NC}"
echo "This will apply the migration to add the missing 'name' column to the jobs table"
echo ""

# Safety confirmation
read -p "Do you want to continue? This will modify your production database. (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Applying migration...${NC}"

# Apply the migration
psql "$DATABASE_URL" -f migrations/add_missing_name_column.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully!${NC}"
    echo ""
    echo "The 'name' column has been added to the jobs table if it was missing."
    echo "Existing jobs have been updated with default names."
else
    echo -e "${RED}❌ Migration failed!${NC}"
    echo "Please check the error above and fix any issues before retrying."
    exit 1
fi