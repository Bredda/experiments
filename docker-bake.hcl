# Builds both images at once, in parallel, from the repository root:
#   docker buildx bake -f docker-bake.hcl
# This is what the CI builds to check them. The release workflow builds and
# publishes the same Dockerfiles with docker/build-push-action, which also
# tags them. docker-compose.yml is not read by the CI: it needs a .env file.

group "default" {
  targets = ["api", "ui"]
}

target "api" {
  context    = "."
  dockerfile = "apps/api/Dockerfile"
}

target "ui" {
  context    = "."
  dockerfile = "apps/ui/Dockerfile"
}
