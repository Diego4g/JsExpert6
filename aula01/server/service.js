import fs from "fs";
import fspromises from "fs/promises";
import config from "./config.js";
import { join, extname } from "path";

const {
  dir: {
    publicDirectory
  }
} = config

export class Service {
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