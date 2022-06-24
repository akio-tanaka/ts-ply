import fs from "fs";

const DELIMITER = /[ \t]/gm;

const PropertyType = {
  char: "char",
  uchar: "uchar",
  short: "short",
  ushort: "ushort",
  int: "int",
  uint: "uint",
  float: "float",
  double: "double",
} as const;
type PropertyType = typeof PropertyType[keyof typeof PropertyType];

abstract class Property {
  constructor(public name: string, public type: PropertyType) {}
  abstract parseNext(tokens: string[], tokenIndex: number): number;
  abstract readNext(buffer: Buffer, offset: number): number;
  abstract readNextBigEndian(buffer: Buffer, offset: number): number;

  static parseValue(token: string, type: PropertyType): number {
    switch (type) {
      case PropertyType.char:
      case PropertyType.uchar:
      case PropertyType.short:
      case PropertyType.ushort:
      case PropertyType.int:
      case PropertyType.uint:
          return parseInt(token);
      case PropertyType.float:
      case PropertyType.double:
          return parseFloat(token);
      default:
          throw new Error("invalid property type");
  }
  }

  static readValue(buffer: Buffer, type: PropertyType, offset: number, littleEndian: boolean): number {
    switch (type) {
      case PropertyType.char:        
        return buffer.readInt8(offset);
      case PropertyType.uchar:
        return buffer.readUint8(offset);
      case PropertyType.short:
        return littleEndian
          ? buffer.readInt16LE(offset)
          : buffer.readInt16BE(offset);
      case PropertyType.ushort:
        return littleEndian
          ? buffer.readUint16LE(offset)
          : buffer.readUint16BE(offset);
      case PropertyType.int:
        return littleEndian
          ? buffer.readInt32LE(offset)
          : buffer.readInt32BE(offset);
      case PropertyType.uint:
        return littleEndian
          ? buffer.readUint32LE(offset)
          : buffer.readUint32BE(offset); 
      case PropertyType.float:
        return littleEndian
          ? buffer.readFloatLE(offset)
          : buffer.readFloatBE(offset);
      case PropertyType.double:
        return littleEndian
          ? buffer.readDoubleLE(offset)
          : buffer.readDoubleBE(offset);
      default:
        throw new Error("invalid property type");
    }
  }

  static getNumByte(type: PropertyType): number {
    switch (type) {
      case PropertyType.char:
      case PropertyType.uchar:
        return 1;
      case PropertyType.short:
      case PropertyType.ushort:
        return 2;
      case PropertyType.int:
      case PropertyType.uint:
      case PropertyType.float:
        return 4;
      case PropertyType.double:
        return 8;
      default:
        throw new Error("invalid property type");
    }
  }
}

class TypedProperty extends Property {
  constructor(name: string, type: PropertyType, public values: number[] = []) {
      super(name, type);
  }

  parseNext(tokens: string[], tokenIndex: number): number {
    this.values.push(Property.parseValue(tokens[tokenIndex++], this.type));
    return tokenIndex;
  }

  readNext(buffer: Buffer, offset: number): number {
    this.values.push(Property.readValue(buffer, this.type, offset, true));
    offset += Property.getNumByte(this.type);
    return offset;
  }

  readNextBigEndian(buffer: Buffer, offset: number): number {
    this.values.push(Property.readValue(buffer, this.type, offset, false));
    offset += Property.getNumByte(this.type);
    return offset;
  }
}

class TypedListProperty extends Property {
  public flattenedData: number[] = [];
  public flattenedIndexStart = [0];

  constructor(public name: string, type: PropertyType, public listCountBytes: number) {
      super(name, type);
  }

  parseNext(tokens: string[], tokenIndex: number): number {
      const count = parseInt(tokens[tokenIndex++]);
      const afterSize = this.flattenedData.length + count;
      for (let i = 0; i < count; i++) {
        this.flattenedData.push(Property.parseValue(tokens[tokenIndex++], this.type));
      }
      this.flattenedIndexStart.push(afterSize);
      return tokenIndex;
  }

  readNext(buffer: Buffer, offset: number): number {
    let count = 0;
    switch(this.listCountBytes) {
      case 1:
        count = buffer.readUint8(offset);
        break;
      case 2:
        count = buffer.readUint16LE(offset);
        break;
      case 4:
        count = buffer.readUint32LE(offset);
        break;
      default:
        throw new Error("invalid listCountBytes");
    }
    offset += this.listCountBytes;

    const afterSize = this.flattenedData.length + count;
    for (let i = 0; i < count; i++) {
      this.flattenedData.push(Property.readValue(buffer, this.type, offset, true));
      offset += Property.getNumByte(this.type);
    }
    this.flattenedIndexStart.push(afterSize);
    return offset;
  }

  readNextBigEndian(buffer: Buffer, offset: number): number {
    let count = 0;
    switch(this.listCountBytes) {
      case 1:
        count = buffer.readUint8(offset);
        break;
      case 2:
        count = buffer.readUint16BE(offset);
        break;
      case 4:
        count = buffer.readUint32BE(offset);
        break;
      default:
        throw new Error("invalid listCountBytes");
    }
    offset += this.listCountBytes;

    const afterSize = this.flattenedData.length + count;
    for (let i = 0; i < count; i++) {
      this.flattenedData.push(Property.readValue(buffer, this.type, offset, false));
      offset += Property.getNumByte(this.type);
    }
    this.flattenedIndexStart.push(afterSize);
    return offset;
  }
}

function createPropertyWithType(name: string, typeStr: string, isList: boolean, listCountTypeStr: string): Property | undefined {
  let listCountBytes = -1;
  if (isList) {
      switch (listCountTypeStr) {
          case "uchar":
          case "uint8":
          case "char":
          case "int8":
              listCountBytes = 1;
              break;
          case "ushort":
          case "uint16":
          case "short":
          case "int16":
              listCountBytes = 2;
              break;
          case "uint":
          case "uint32":
          case "int":
          case "int32":
              listCountBytes = 4;
              break;
          default:
              return undefined;
      }
  }

  switch (typeStr) {
      case "uchar":
      case "uint8":
          return isList
            ? new TypedListProperty(name, PropertyType.uchar, listCountBytes)
            : new TypedProperty(name, PropertyType.uchar);
      case "ushort":
      case "uint16":
          return isList
            ? new TypedListProperty(name, PropertyType.ushort, listCountBytes)
            : new TypedProperty(name, PropertyType.ushort);
      case "uint":
      case "uint32":
          return isList
            ? new TypedListProperty(name, PropertyType.uint, listCountBytes)
            : new TypedProperty(name, PropertyType.uint);
      case "char":
      case "int8":
          return isList
            ? new TypedListProperty(name, PropertyType.char, listCountBytes)
            : new TypedProperty(name, PropertyType.char);
      case "short":
      case "int16":
          return isList
            ? new TypedListProperty(name, PropertyType.short, listCountBytes)
            : new TypedProperty(name, PropertyType.short);
      case "int":
      case "int32":
          return isList
            ? new TypedListProperty(name, PropertyType.int, listCountBytes)
            : new TypedProperty(name, PropertyType.int);
      case "float":
      case "float32":
          return isList
            ? new TypedListProperty(name, PropertyType.float, listCountBytes)
            : new TypedProperty(name, PropertyType.float);
      case "double":
      case "float64":
          return isList
            ? new TypedListProperty(name, PropertyType.double, listCountBytes)
            : new TypedProperty(name, PropertyType.double);
      default:
          return undefined;
  }
}

type Element = {
  name: string;
  count: number;
  properties: Property[];
};

type Header = {
  type: string;
  version: string;
  comments: string[];
  objInfoComments: string[];
};

export type Faces = {
  indices: number[];
  strides: number[];
}

export class PlyData {
  private header: Header= {
    type: "",
    version: "",
    comments: [],
    objInfoComments: [],
  };
  private elements: Element[] = [];

  private _parseHeader(lines: string[]): boolean {
    try {
      let lineCount = 0;
      if (lines[lineCount++].trim() != "ply") {
          return false;
      }
      {
        const tokens = lines[lineCount++].split(DELIMITER);
        if (tokens.length != 3) {
          return false;
        }

        const formatStr = tokens[0];
        this.header.type = tokens[1];
        this.header.version = tokens[2];
        if (formatStr != "format") {
          return false;
        }
        if (this.header.version != "1.0") {
          return false;
        }
      }

      for (let i = lineCount; i < lines.length; ++i) {
        if (lines[i] == "") {
          continue;
        }
        if (lines[i].startsWith("comment")) {
          this.header.comments.push(lines[i].substring(8));
        }
        else if (lines[i].startsWith("obj_info")) {
          this.header.objInfoComments.push(lines[i].substring(9));
        }
        else if (lines[i].startsWith("element")) {
          const tokens = lines[i].split(DELIMITER);
          if (tokens.length != 3) {
            return false;
          }
          this.elements.push({ name: tokens[1], count: parseInt(tokens[2]), properties: [] });
        }
        else if (lines[i].startsWith("property list")) {
          const tokens = lines[i].split(DELIMITER);
          if (tokens.length != 5) {
            return false;
          }
          if (this.elements.length == 0) {    
            return false;
          }
          const property = createPropertyWithType(tokens[4], tokens[3], true, tokens[2]);
          if (!property) {
            return false;
          }
          this.elements[this.elements.length - 1].properties.push(property);
        }
        else if (lines[i].startsWith("property")) {
          const tokens = lines[i].split(DELIMITER);
          if (tokens.length != 3) {
            return false;
          }
          if (this.elements.length == 0) {                  
            return false;
          }
          const property = createPropertyWithType(tokens[2], tokens[1], false, "");
          if (!property) {                  
            return false;
          }
          this.elements[this.elements.length - 1].properties.push(property);
        }
        else if (lines[i].startsWith("end_header")) {
          break;
        }
        else {              
          return false;
        }
      }
    }
    catch (e) {      
      return false;
    }
    return true;
  }

  private _parseAscii(lines: string[]): void {
    let lineCount = 0;
    for (const element of this.elements) {
      for (let i = 0; i < element.count; i++) {
        let line = lines[lineCount++];

        if (element.properties.length == 0) {
          while (line == "") {
            line = lines[lineCount++];
          }
        }
        const tokens = line.split(DELIMITER);
        let iTok = 0;
        for (const property of element.properties) {
          iTok =property.parseNext(tokens, iTok);
        }
      }
    }
  }

  private _parseBinary(buffer: Buffer): void {
    let offset = 0;
    for (const element of this.elements) {
      for (let i = 0; i < element.count; i++) {
        for (const property of element.properties) {
          offset = property.readNext(buffer, offset);
        }
      }
    }
  }

  private _parseBinaryBigEndian(buffer: Buffer): void {
    let offset = 0;
    for (const element of this.elements) {
      for (const property of element.properties) {
        offset = property.readNextBigEndian(buffer, offset);
      }
    }
  }  

  load(filepath: string): boolean {
    const buf = fs.readFileSync(filepath);

    const splitByEndHeader = (data: Uint8Array): Uint8Array[] => {
      const target = "end_header\n"
      const targetCode = [];
      for (let i = 0; i < target.length; i++) {
        targetCode.push(target.charCodeAt(i));
      }
      for (let i = 0; i < data.length; i++) {
        let matched = true;
        let curIndex = i;
        for (let j = 0; j < targetCode.length; j++) {
          if (curIndex >= data.length || data[curIndex++] != targetCode[j]) {
            matched = false;
            break;
          }
        }
        if (matched) {
          const headerLength = i + targetCode.length;
          return [data.slice(0, headerLength), data.slice(headerLength - data.length)];
        }
      }
      return [];
    };

    const splittedBuf = splitByEndHeader(buf);
    if (splittedBuf.length != 2) {
      return false;
    }
    if (!this._parseHeader(splittedBuf[0].toString().split("\n"))) {
      return false;
    }

    const getContentAsLines = (): string[] => {
      return splittedBuf[1].toString().split("\n");
    }

    const getContentAsDataView = (): Buffer => {
      return new Buffer(splittedBuf[1]);
    };

    try {
      switch (this.header.type) {
        case "ascii":
          this._parseAscii(getContentAsLines());
          break;
        case "binary_little_endian":
          this._parseBinary(getContentAsDataView());
          break;
        case "binary_big_endian":
          this._parseBinaryBigEndian(getContentAsDataView());
          break;
        default:
          return false;
      }
    }
    catch(e) {
      return false;
    }
    return true;
  }

  private _writeHeader(ws: fs.WriteStream): void {
    const writeHeaderOfProperty = (property: Property): void => {
      const propertyPrefix = property instanceof TypedProperty
        ? "property"
        : "property list uchar";
      ws.write(`${propertyPrefix} ${property.type} ${property.name}\n`);
    };

    const writeHeaderOfElement = (element: Element): void => {
      ws.write(`element ${element.name} ${element.count}\n`);
      for (const property of element.properties) {
        writeHeaderOfProperty(property);
      }
    };

    ws.write("ply\n");
    ws.write(`format ascii ${this.header.version}\n`);

    for (const comment of this.header.comments) {
      ws.write(`comment ${comment}\n`);
    }
    for (const objInfoComment of this.header.objInfoComments) {
      ws.write(`obj_info ${objInfoComment}\n`);
    }
    for (const element of this.elements) {
      writeHeaderOfElement(element);
    }
    ws.write("end_header\n");
  }

  save(filepath: string): boolean {
    const writeProperty =(ws: fs.WriteStream, property: Property, index: number): void => {
      if (property instanceof TypedProperty) {
        ws.write(`${property.values[index]} `);
      }
      else if(property instanceof TypedListProperty) {
        const start = property.flattenedIndexStart[index];
        const end = property.flattenedIndexStart[index + 1];
        const count = end - start;
        ws.write(`${count}`);
        for (let i = start; i < end; i++) {
          ws.write(` ${property.flattenedData[i]}`);
        }
        ws.write(` `);
      }
      else {
        throw new Error("invalid property type");
      }
    };

    try {
      const ws = fs.createWriteStream(filepath);
      this._writeHeader(ws);
      for (const element of this.elements) {
        for (let i = 0; i < element.count; i++) {
          for (const property of element.properties) {
            writeProperty(ws, property, i);
          }
          ws.write("\n");
        }
      }
      ws.end();
    }
    catch(e) {
      return false;
    }
    return true;
  }

  private _getVertexValues(vertexElementName: string, componentName1: string, componentName2: string, componentName3: string): number[] {
    const vertex = this.elements.find(element => element.name === vertexElementName);
    const property1 = vertex?.properties.find(property => property.name === componentName1);
    const property2 = vertex?.properties.find(property => property.name === componentName2);
    const property3 = vertex?.properties.find(property => property.name === componentName3);
    if (!property1 || !property2 || !property3) {
      throw new Error("vertex element or properties not found");
    }

    const getValues = (property: Property): number[] => {
      return property instanceof TypedProperty
        ? property.values
        : [];
    };

    const values1 = getValues(property1);
    const values2 = getValues(property2);
    const values3 = getValues(property3);
    if (values1.length !== values2.length || values1.length !== values3.length) {
      throw new Error("invalid vertex properties");
    }

    const ret: number[] = [];
    for (let i = 0; i < values1.length; i++) {
      ret.push(values1[i]);
      ret.push(values2[i]);
      ret.push(values3[i]);
    }
    return ret;
  }

  getVertexPositions(vertexElementName: string = "vertex"): number[] {
    return this._getVertexValues(vertexElementName, "x", "y", "z");
  }

  getVertexColors(vertexElementName: string = "vertex"): number[] {
    return this._getVertexValues(vertexElementName, "red", "green", "blue");
  }

  getFaces(): Faces {
    const getIndices = (property: Property | undefined): Faces | null => {
      if (!property) {
        return null;
      }
      return property instanceof TypedListProperty
        ? { indices: property.flattenedData, strides: property.flattenedIndexStart }
        : null;
    }

    const face = this.elements.find(element => element.name === "face");
    const vertexIndices = face?.properties.find(property => property.name === "vertex_indices");
    const vertexIndex = face?.properties.find(property => property.name === "vertex_index");

    let ret = getIndices(vertexIndices);
    if (!ret) {
      ret = getIndices(vertexIndex);
      if (!ret) {
        throw new Error("vertex indices property not found");
      }
    }
    return ret;
  }
}