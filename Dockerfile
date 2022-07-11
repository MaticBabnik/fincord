FROM node:18-bullseye AS build
RUN apt-get -y update && apt-get -y install build-essential
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:18-bullseye
RUN apt-get -y update && apt-get -y install ffmpeg 
WORKDIR /app
COPY --from=build /app /app

ENTRYPOINT [ "node", "build/index.js" ]
