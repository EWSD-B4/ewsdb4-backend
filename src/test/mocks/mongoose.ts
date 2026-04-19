const createConnection = () => ({
  on: jest.fn(),
  once: jest.fn(),
  readyState: 1,
});

class MockSchema {
  static Types = {
    Mixed: class Mixed {},
  };

  constructor(_definition?: unknown, _options?: unknown) {}

  index = jest.fn();
}

const modelApi = {
  findOne: jest.fn(),
  find: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  deleteMany: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mongoose = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  model: jest.fn().mockReturnValue(modelApi),
  connection: createConnection(),
  Schema: MockSchema,
};

export const Schema = MockSchema;
export default mongoose;
