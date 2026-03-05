# GitHub Actions Setup for Your Project

Your GitHub Actions workflow has been configured with the following features:

## Files Created

### 1. `.github/workflows/ci.yml`
Main CI/CD pipeline that runs on push to `main` and `develop` branches, and on pull requests.

**Two jobs:**
- **lint-and-build**: Runs linting and builds for both frontend and backend. Includes a PostgreSQL service for database-dependent tests.
- **docker-build**: Builds Docker images for frontend and backend using Docker Buildx with GitHub Actions cache for faster builds.

### 2. `Dockerfile.frontend`
Multi-stage build for your React/Vite application:
- **Stage 1 (builder)**: Installs dependencies and builds the production bundle
- **Stage 2 (runtime)**: Runs the built app with `serve` on port 3000

### 3. `server/Dockerfile`
Multi-stage build for your Express/TypeScript backend:
- **Stage 1 (builder)**: Compiles TypeScript to JavaScript
- **Stage 2 (runtime)**: Runs the compiled app on port 5000 with production dependencies only

### 4. Updated `docker-compose.yml`
Now includes three services:
- **postgres**: Database with health checks
- **backend**: Express server with volume mounts for development hot-reload
- **frontend**: React app with volume mounts for development hot-reload

### 5. `.dockerignore` files
Prevents unnecessary files from being copied into Docker images, speeding up builds.

## Docker Steps in GitHub Actions

Your workflow uses Docker for:

1. **Multi-stage builds**: Reduces image sizes by separating build and runtime environments
2. **Build caching**: Uses GitHub Actions Cache to speed up subsequent builds
3. **Service containers**: PostgreSQL runs as a service during CI tests
4. **Docker Buildx**: Modern build tool with cache support for faster CI/CD

## Running Locally

```bash
# Build and run all services
docker compose up --build

# Build specific service
docker compose build frontend
docker compose build backend

# Run just frontend in development
docker compose up frontend postgres --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

## In GitHub Actions

The workflow automatically:
- Runs on every push to main/develop
- Runs on all pull requests
- Lints your code
- Builds your frontend and backend
- Tests database connectivity
- Builds Docker images with caching

## Performance Considerations

- **Build cache**: GitHub Actions cache persists between runs, making rebuilds ~3-5x faster
- **Node cache**: npm dependencies are cached automatically
- **Alpine images**: Smaller base images reduce build and pull times
- **Multi-stage builds**: Production images contain only runtime dependencies

## Customize As Needed

Edit `.github/workflows/ci.yml` to:
- Add testing steps (`npm test`)
- Add Docker image push (to Docker Hub, GitHub Container Registry)
- Run database migrations in the PostgreSQL service
- Add security scanning with Docker Scout
