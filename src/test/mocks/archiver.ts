const archiveInstance = {
  pipe: jest.fn(),
  append: jest.fn(),
  file: jest.fn(),
  directory: jest.fn(),
  finalize: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  pointer: jest.fn().mockReturnValue(0),
};

const archiver = jest.fn().mockReturnValue(archiveInstance);

export default archiver;
