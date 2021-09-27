#!/bin/bash
set -ex

echo Type version number:
read VERSION

docker build -t ptrskay3/void:$VERSION . 
docker push ptrskay3/void:$VERSION 
cd .. 
eval $(ssh-agent -s)
ssh-add id_rsa
ssh root@167.172.177.93 "docker pull ptrskay3/void:$VERSION && docker tag ptrskay3/void:$VERSION dokku/api:$VERSION && dokku tags:deploy api $VERSION"
