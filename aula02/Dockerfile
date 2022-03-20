FROM node:17-slim

RUN apt-get update \
  && apt-get install -y sox libsox-fmt-mp3

# cria uma pasta dentro do container
WORKDIR /spotify-radio/

# copia os arquivos package pra pasta acima
COPY package.json package-lock.json /spotify-radio/

# instala os pacotes
RUN npm ci --silent

# copia o nosso código pra pasta raiz do docker
COPY . .

# como boa pratica utilizamos a linha abaixo, pra garantir que ele n vai ter
# acesso a nada alem da nossa aplicação
USER node

# o comando que ele irá iniciar o servidor podendo recarregar conforme alterações
CMD npm run live-reload