ARG NODE_VERSION=10
FROM node:${NODE_VERSION}

RUN mkdir -p /usr/src/kr
RUN mkdir -p /config

WORKDIR /usr/src/kr
COPY data /usr/src/kr
COPY run.sh /usr/src/kr

EXPOSE 8181

CMD ["run.sh"]
