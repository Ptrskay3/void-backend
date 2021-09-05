set -ex

# rebuild the web image
docker-compose -f docker-compose-dev.yaml up -d --no-deps --build web &&

docker-compose -f docker-compose-dev.yaml up