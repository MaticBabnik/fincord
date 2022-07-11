FROM node:18-bullseye AS build
RUN apt update && apt install build-essential
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:18-bullseye

WORKDIR /app
COPY --from=build /app /app

ENTRYPOINT [ "node", "build/index.js" ]