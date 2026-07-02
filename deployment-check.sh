#!/bin/bash

# Deployment Readiness Checklist Script
# Run this before deploying to verify everything is ready

echo "🔍 Thecourtyard Deployment Readiness Check"
echo "==========================================="
echo ""

# Check Git status
echo "✓ Checking Git status..."
if git status --porcelain | grep -q .; then
  echo "  ⚠️  WARNING: Uncommitted changes detected"
  git status --short
else
  echo "  ✅ No uncommitted changes"
fi
echo ""

# Check environment files
echo "✓ Checking environment configuration files..."
if [ -f ".env.example" ]; then
  echo "  ✅ .env.example exists"
else
  echo "  ❌ .env.example missing"
fi

if [ -f "vercel.json" ]; then
  echo "  ✅ vercel.json configured"
else
  echo "  ❌ vercel.json missing"
fi

if [ -f "render.yaml" ]; then
  echo "  ✅ render.yaml configured"
else
  echo "  ❌ render.yaml missing"
fi
echo ""

# Check package.json build scripts
echo "✓ Checking build scripts..."
if grep -q '"build"' package.json; then
  echo "  ✅ Frontend build script exists"
fi

if grep -q '"start"' server/package.json; then
  echo "  ✅ Backend start script exists"
fi
echo ""

# Check dependencies
echo "✓ Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "  ✅ Frontend dependencies installed"
else
  echo "  ⚠️  Frontend dependencies not installed (run: npm install)"
fi

if [ -d "server/node_modules" ]; then
  echo "  ✅ Backend dependencies installed"
else
  echo "  ⚠️  Backend dependencies not installed (run: npm --prefix server install)"
fi
echo ""

echo ""

echo "==========================================="
echo "📋 Pre-Deployment Checklist:"
echo ""
echo "Before deploying, ensure:"
echo "  [ ] All code is committed to Git"
echo "  [ ] package.json versions are updated"
echo "  [ ] DEPLOYMENT_RENDER_VERCEL.md has been reviewed"
echo "  [ ] MySQL database credentials are ready"
echo "  [ ] Gmail app password is generated"
echo "  [ ] Render account created and verified"
echo "  [ ] Vercel account created and verified"
echo "  [ ] GitHub repository is public or authorized"
echo "  [ ] CI/CD environment variables are documented"
echo ""
echo "✨ Ready to deploy!"
echo "  1. Push to GitHub: git push origin main"
echo "  2. Connect Render: Follow DEPLOYMENT_RENDER_VERCEL.md"
echo "  3. Connect Vercel: Follow DEPLOYMENT_RENDER_VERCEL.md"
