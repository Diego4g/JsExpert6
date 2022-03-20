import fs from "fs";
import fspromises from "fs/promises";
import { randomUUID } from "crypto";
import { PassThrough, Writable } from "stream";
import config from "./config.js";
import { join, extname } from "path";
import streamsPromises from "stream/promises";
import { once } from "events";
import Throttle from "throttle";
import  childProcess  from "child_process";
import { logger } from "./util.js"

const {
  dir: {
    publicDirectory
  },
  constants: {
    fallbackBitRate,
    englishConversation,
    bitRateDivisor
  }
} = config

export class Service {
  constructor(){
    this.clientStreams = new Map()
    this.currentSong = englishConversation
    this.currentBitRate = 0
    this.throttleTransform = {}
    this.currentReadable = {}
  }

  createClientStream() {
    const id = randomUUID();
    const clientStream = new PassThrough()
    this.clientStreams.set(id, clientStream)

    return {
      id,
      clientStream
    }
  }

  removeClientStream(id){
    this.clientStreams.delete(id)
  } 

  _executeSoxCommand(args) {
    return childProcess.spawn('sox', args)
  }

  async getBitRate(song) {
    try {
      const args = [
        '--i', // info
        '-B', // bitrate
        song
      ]
      // Quando mandamos um comando pro sistema operacional temos 3 objetos que
      // estão sendo desestruturados abaixo
      const {
        stderr, // pega tudo que é erro
        stdout,  // pega tudo que é sucesso/log
        // stdin   // enviar dados como stream
      } = this._executeSoxCommand(args)

      await Promise.all([
        once(stderr, 'readable'),
        once(stdout, 'readable')
      ])

      const [sucess, error] = [stdout, stderr].map(stream => stream.read());
      // se existir algum erro
      if(error) return await Promise.reject(error) // usamos o await pra ele cair no catch

      return sucess
        .toString()
        .trim() // remove todos espaços
        .replace(/k/, '000') // expressão regular no /k/
    } catch (error) {
      logger.error(`Deu ruim no bitrate: ${error}`)
      return fallbackBitRate
    }
  }

  broadCast() {
    return new Writable({
      write:( chunk, enc, cb) => {
        for ( const [key, stream] of this.clientStreams){
          //se o cliente desconectou não devemos mais mandar dados pra ele
          if(stream.WritableEnded) {
            this.clientStreams.delete(id)
            continue;
          }
          stream.write(chunk)
        }
        cb()
      }
    })
  }

  async startStreaming() {
    logger.info(`starting with ${this.currentSong}`)
    const bitRate = this.currentBitRate = await this.getBitRate(this.currentSong) / bitRateDivisor

    const throttleTransform = this.throttleTransform = new Throttle(bitRate)
    const songReadable = this.currentReadable = this.createFileStream(this.currentSong)
    return streamsPromises.pipeline(
      songReadable, 
      throttleTransform,
      this.broadCast()
    )
  }

  async stopStreaming() {
    this.throttleTransform?.end?.()
  }

  createFileStream(filename) {
    return fs.createReadStream(filename);
  }

  async getFileInfo(file) {

    // o arquivo file vem da seguine forma por exemplo: file = home/index.html
    // então fazemos a tratativa
    const fullFilePath = join(publicDirectory, file);

    // valida se existe, se não existe estoura erro
    await fspromises.access(fullFilePath);

    const fileType = extname(fullFilePath); // pega o tipo de extensão do arquivo

    return {
      type: fileType,
      name: fullFilePath
    }
  }

  async getFileStream(file) {
    const { name, type } = await this.getFileInfo(file);

    return {
      stream: this.createFileStream(name),
      type
    }
  }
}