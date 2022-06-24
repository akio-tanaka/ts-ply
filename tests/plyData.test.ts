import { PlyData } from "../src/plyData";

describe('fetch todo title test', () => {

  const expectedPositions = [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const expectedIndices = [2, 1, 0, 1, 2, 3, 4, 2, 0, 2, 4, 6, 1, 4, 0, 4, 1, 5, 6, 5, 7, 5, 6, 4, 3, 6, 7, 6, 3, 2, 5, 3, 7, 3, 5, 1];
  const expectedStrides = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
  const expectedColors = [255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0];

  test("load ascii format", () => {
    const ply = new PlyData();
    expect(ply.load("./tests/data/cube_ascii.ply")).toBe(true);
    
    const positions = ply.getVertexPositions();
    positions.forEach((position, i) => {
      expect(position).toBeCloseTo(expectedPositions[i]);
    });
    const faces = ply.getFaces();
    
    faces.indices.forEach((index, i) => {
      expect(index).toBe(expectedIndices[i]);
    });
    faces.strides.forEach((stride, i) => {
      expect(stride).toBe(expectedStrides[i]);
    });

    expect(() => { ply.getVertexColors(); }).toThrow();
  });

  test("load binary_little_endian format", () => {
    const ply = new PlyData();
    expect(ply.load("./tests/data/cube.ply")).toBe(true);

    const positions = ply.getVertexPositions();
    positions.forEach((position, i) => {
      expect(position).toBeCloseTo(expectedPositions[i]);
    });

    const faces = ply.getFaces();
    faces.indices.forEach((index, i) => {
      expect(index).toBe(expectedIndices[i]);
    });
    faces.strides.forEach((stride, i) => {
      expect(stride).toBe(expectedStrides[i]);
    });

    expect(() => { ply.getVertexColors(); }).toThrow();
  });

  test("load ascii format with colors", () => {
    const ply = new PlyData();
    expect(ply.load("./tests/data/cube_ascii_with-color.ply")).toBe(true);

    const positions = ply.getVertexPositions();
    positions.forEach((position, i) => {
      expect(position).toBeCloseTo(expectedPositions[i]);
    });

    const faces = ply.getFaces();
    faces.indices.forEach((index, i) => {
      expect(index).toBe(expectedIndices[i]);
    }); 
    faces.strides.forEach((stride, i) => {
      expect(stride).toBe(expectedStrides[i]);
    });

    const colors = ply.getVertexColors();
    colors.forEach((color, i) => {
      expect(color).toBe(expectedColors[i]);
    });
  });

  test("load binary_little_endian format with colors", () => {
    const ply = new PlyData();
    expect(ply.load("./tests/data/cube_with-color.ply")).toBe(true);

    const positions = ply.getVertexPositions();
    positions.forEach((position, i) => {
      expect(position).toBeCloseTo(expectedPositions[i]);
    });

    const faces = ply.getFaces();
    faces.indices.forEach((index, i) => {
      expect(index).toBe(expectedIndices[i]);
    }); 
    faces.strides.forEach((stride, i) => {
      expect(stride).toBe(expectedStrides[i]);
    });

    const colors = ply.getVertexColors();
    colors.forEach((color, i) => {
      expect(color).toBe(expectedColors[i]);
    });
  });
});