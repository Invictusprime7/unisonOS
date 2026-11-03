#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up local development environment...${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 24+ from https://nodejs.org/${NC}"
    exit 1
fi

NODE_MAJOR_VERSION="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR_VERSION" -lt 24 ]; then
    echo -e "${RED}❌ Node.js 24+ is required; found $(node -v). Please install Node.js 24+ from https://nodejs.org/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check if npm or bun is available
if command -v bun &> /dev/null; then
    PACKAGE_MANAGER="bun"
    echo -e "${GREEN}✓ Using bun as package manager${NC}"
elif command -v npm &> /dev/null; then
    PACKAGE_MANAGER="npm"
    echo -e "${GREEN}✓ Using npm as package manager${NC}"
else
    echo -e "${RED}❌ No package manager found${NC}"
    exit 1
fi

# Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
$PACKAGE_MANAGER install

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "\n${YELLOW}⚙️  Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Check if Supabase CLI is installed (optional)
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✓ Supabase CLI detected${NC}"
else
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Install with: npm install -g supabase${NC}"
fi

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Review .env file and update if needed"
echo -e "  2. Run: ${GREEN}$PACKAGE_MANAGER run dev${NC} to start development server"
echo -e "  3. Open: ${GREEN}http://localhost:8080${NC}\n"
