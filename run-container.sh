#!/bin/bash

docker container rm ap
docker run --name ap -p 7770:7770 localhost/ap

sleep 2
docker container logs ap
