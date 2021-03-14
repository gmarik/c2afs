FROM ubuntu

RUN apt-get update && apt-get install -y \
  ca-certificates \
  # cross-compilers
  gcc-arm-linux-gnueabi binutils-arm-linux-gnueabi \
  # executing arm32 binaries on x86 host
  # https://azeria-labs.com/arm-on-x86-qemu-user/
  qemu-user qemu-user-static \
  make \
  curl

ARG NODE_VERSION=14.16.0
ARG NODE_PACKAGE=node-v$NODE_VERSION-linux-x64
ARG NODE_HOME=/opt/$NODE_PACKAGE

ENV NODE_PATH $NODE_HOME/lib/node_modules
ENV PATH $NODE_HOME/bin:$PATH

RUN curl https://nodejs.org/dist/v$NODE_VERSION/$NODE_PACKAGE.tar.gz | tar -xzC /opt/

RUN npm install -g typescript ts-node nodemon

WORKDIR /app
ENV HISTFILE=/app/.bash.histfile
