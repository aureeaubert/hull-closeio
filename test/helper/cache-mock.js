module.exports = {
  wrap: jest.fn((key, cb) => {
    return Promise.resolve(cb());
  }),
  get: jest.fn(() => {
    return Promise.resolve();
  }),
  set: jest.fn(() => {
    return Promise.resolve();
  }),
  del: jest.fn(() => {
    return Promise.resolve();
  })
};
