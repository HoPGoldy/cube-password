/**
 * ip2region searcher — 移植自旧项目
 * @see https://github.com/lionsoul2014/ip2region
 */

import fs from "fs";

const VectorIndexSize = 8;
const VectorIndexCols = 256;
const VectorIndexLength = 256 * 256 * (4 + 4);
const SegmentIndexSize = 14;
const IP_REGEX =
  /^((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.){3}(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/;

export const isValidIp = (ip: string): boolean => {
  return IP_REGEX.test(ip);
};

class Searcher {
  private vectorIndex: Buffer | null;
  private buffer: Buffer | null;
  private dbFile: string | null;

  constructor(
    dbFile: string | null,
    vectorIndex: Buffer | null,
    buffer: Buffer | null,
  ) {
    this.dbFile = dbFile;
    this.vectorIndex = vectorIndex;
    this.buffer = buffer;

    if (this.buffer) {
      this.vectorIndex = this.buffer.subarray(256, 256 + VectorIndexLength);
    }
  }

  private getStartEndPtr(idx: number): { sPtr: number; ePtr: number } {
    if (!this.vectorIndex) {
      throw new Error("vectorIndex is not loaded");
    }
    const sPtr = this.vectorIndex.readUInt32LE(idx);
    const ePtr = this.vectorIndex.readUInt32LE(idx + 4);
    return { sPtr, ePtr };
  }

  private getBuffer(offset: number, length: number): Buffer {
    if (!this.buffer) {
      throw new Error("buffer is not loaded");
    }
    return this.buffer.subarray(offset, offset + length);
  }

  search(ip: string): { region: string | null } {
    if (!isValidIp(ip)) {
      throw new Error(`IP: ${ip} is invalid`);
    }

    const ps = ip.split(".");
    const i0 = parseInt(ps[0]);
    const i1 = parseInt(ps[1]);
    const i2 = parseInt(ps[2]);
    const i3 = parseInt(ps[3]);

    const ipInt = i0 * 256 * 256 * 256 + i1 * 256 * 256 + i2 * 256 + i3;
    const idx = i0 * VectorIndexCols * VectorIndexSize + i1 * VectorIndexSize;
    const { sPtr, ePtr } = this.getStartEndPtr(idx);

    let l = 0;
    let h = (ePtr - sPtr) / SegmentIndexSize;
    let result: string | null = null;

    while (l <= h) {
      const m = (l + h) >> 1;
      const p = sPtr + m * SegmentIndexSize;
      const buff = this.getBuffer(p, SegmentIndexSize);
      const sip = buff.readUInt32LE(0);

      if (ipInt < sip) {
        h = m - 1;
      } else {
        const eip = buff.readUInt32LE(4);
        if (ipInt > eip) {
          l = m + 1;
        } else {
          const dataLen = buff.readUInt16LE(8);
          const dataPtr = buff.readUInt32LE(10);
          const data = this.getBuffer(dataPtr, dataLen);
          result = data.toString("utf-8");
          break;
        }
      }
    }

    return { region: result };
  }
}

export const loadContentFromFile = (dbPath: string): Buffer => {
  const stats = fs.statSync(dbPath);
  const buffer = Buffer.alloc(stats.size);
  const fd = fs.openSync(dbPath, "r");
  fs.readSync(fd, buffer, 0, stats.size, 0);
  fs.closeSync(fd);
  return buffer;
};

export const newWithBuffer = (buffer: Buffer): Searcher => {
  return new Searcher(null, null, buffer);
};
