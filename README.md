## Set Up the Project
- clone the repo
```bash
git clone https://github.com/amitanshusahu/node-containerized-execution-env.git
```
- open the repo folder `cd <repo-name>`
- install all dependencies
```bash
npm i
```
- pull node and gcc docker image
```bash
# pull latest node image
docker pull node
# pull latest gcc image
docker pull gcc
```
- run RabbitMq and bind it to port 5672 in a terminal instance
```bash
docker run \
-p 5672:5672 \
rabbitmq
```
- open another terminal instance and run the node server, from server folder
```bash
# go to server folder
cd server
# start the server
npm start
```
- open another terminal instance and serve the index.html, from client folder
```bash
# go from server folder to  client folder
cd ../client
# create a static server 
npx serve
```

> make sure `3000`, `3010`, `5672` are not bussyyyy!!

## Refferences
- [Remote Code Execution System just like kirat said](https://blog.devgenius.io/case-study-remote-code-execution-engine-system-63aa43344f24)
- [Using RabbitMQ in node js app](https://www.rabbitmq.com/tutorials/tutorial-one-javascript.html)
- [Docker Engine API to create and work with containers](https://docs.docker.com/engine/api/v1.42/#tag/Container/operation/ContainerCreate)
- [An Implementation of the Docker API as node package - Dockerode](https://github.com/apocas/dockerode)
- [Running Docker/Commnds using "child-process" module in node js (exec, spwan)](https://stackoverflow.com/questions/35644155/how-can-i-dynamically-create-a-docker-container-from-a-node-application)
- [Parallel Processing/Multithreading in node js](https://deepsource.com/blog/nodejs-worker-threads/)
- __Video Tutorials__
    - [What are Messagin queue, RabbitMQ pub/sub with nodjs](https://youtu.be/e03c3CIGtYU)
    - [Docker Tutorial, all about docker](https://youtu.be/3c-iBn73dDE)
    - [Scale node js app using cluster module and test it with loadTest](https://youtu.be/9RLeLngtQ3A)


<h3 align="center"> Star the Repo :star </h3>