/* global describe, test, expect */

const statusCheckAction = require("../../server/actions/status-check");
const SHARED_MESSAGES = require("../../server/lib/shared-messages");
const { ShipMock } = require("../helper/shipmock");

describe("statusCheckAction", () => {
  test("should return status ok if connector is properly configured", () => {
    const private_settings = {
      api_key: "1234567abcd=",
      synchronized_account_segments: ["leads"]
    };

    const metricClientMock = {};
    const incrementMock = jest.fn().mockImplementation(() => {
      console.log("metricClient.increment mocked function called");
    });
    metricClientMock.increment = incrementMock.bind(metricClientMock);

    const responseMock = {};
    const jsonMock = jest.fn().mockImplementation(() => {
      console.log("response.json mocked function called");
    });
    responseMock.json = jsonMock.bind(responseMock);

    const clientMock = {};
    const configMock = jest.fn().mockImplementation(() => {
      return { secret: "1234" };
    });
    const putMock = jest.fn().mockImplementation(() => {
      console.log("client.put mocked function called");
    });
    clientMock.configuration = configMock.bind(clientMock);
    clientMock.put = putMock.bind(clientMock);

    const req = {
      url: "https://hull-closeio.herokuapp.com/",
      hull: {
        client: clientMock,
        connector: new ShipMock("1234", {}, private_settings)
      }
    };

    statusCheckAction(req, responseMock);
    expect(jsonMock.mock.calls[0][0]).toEqual({ status: "ok", messages: [] });
  });

  test("should return status warning if connector has no synchronized_segments", () => {
    const private_settings = {
      api_username: "sven+dev@hull.io",
      api_key: "1234567abcd=",
      synchronized_account_segments: []
    };

    const metricClientMock = {};
    const incrementMock = jest.fn().mockImplementation(() => {
      console.log("metricClient.increment mocked function called");
    });
    metricClientMock.increment = incrementMock.bind(metricClientMock);

    const responseMock = {};
    const jsonMock = jest.fn().mockImplementation(() => {
      console.log("response.json mocked function called");
    });
    responseMock.json = jsonMock.bind(responseMock);

    const clientMock = {};
    const configMock = jest.fn().mockImplementation(() => {
      return { secret: "1234" };
    });
    const putMock = jest.fn().mockImplementation(() => {
      console.log("client.put mocked function called");
    });
    clientMock.configuration = configMock.bind(clientMock);
    clientMock.put = putMock.bind(clientMock);

    const req = {
      url: "https://hull-closeio.herokuapp.com/",
      hull: {
        client: clientMock,
        connector: new ShipMock("1234", {}, private_settings)
      }
    };

    statusCheckAction(req, responseMock);
    expect(jsonMock.mock.calls[0][0]).toEqual({
      status: "warning",
      messages: [SHARED_MESSAGES.STATUS_WARNING_NOSEGMENTS().message]
    });
  });

  test("should return status error if connector has no proper auth", () => {
    const private_settings = {
      api_key: null,
      synchronized_account_segments: ["leads"]
    };

    const metricClientMock = {};
    const incrementMock = jest.fn().mockImplementation(() => {
      console.log("metricClient.increment mocked function called");
    });
    metricClientMock.increment = incrementMock.bind(metricClientMock);

    const responseMock = {};
    const jsonMock = jest.fn().mockImplementation(() => {
      console.log("response.json mocked function called");
    });
    responseMock.json = jsonMock.bind(responseMock);

    const clientMock = {};
    const configMock = jest.fn().mockImplementation(() => {
      return { secret: "1234" };
    });
    const putMock = jest.fn().mockImplementation(() => {
      console.log("client.put mocked function called");
    });
    clientMock.configuration = configMock.bind(clientMock);
    clientMock.put = putMock.bind(clientMock);

    const req = {
      url: "https://hull-closeio.herokuapp.com/",
      hull: {
        client: clientMock,
        connector: new ShipMock("1234", {}, private_settings)
      }
    };

    statusCheckAction(req, responseMock);
    expect(jsonMock.mock.calls[0][0]).toEqual({
      status: "error",
      messages: [SHARED_MESSAGES.STATUS_ERROR_NOAPIKEY().message]
    });
  });

  test("should return status 404 if no private settings are present", () => {
    const metricClientMock = {};
    const incrementMock = jest.fn().mockImplementation(() => {
      console.log("metricClient.increment mocked function called");
    });
    metricClientMock.increment = incrementMock.bind(metricClientMock);

    const responseMock = {};
    const jsonMock = jest.fn().mockImplementation(() => {
      console.log("response.status.json mocked function called");
    });
    const statusMockReturn = {};
    statusMockReturn.json = jsonMock.bind(statusMockReturn);
    const statusMock = jest.fn().mockImplementation(() => {
      console.log("response.status mocked function called");
      return statusMockReturn;
    });
    responseMock.status = statusMock.bind(responseMock);

    const clientMock = {};
    const configMock = jest.fn().mockImplementation(() => {
      return { secret: "1234" };
    });
    const putMock = jest.fn().mockImplementation(() => {
      console.log("client.put mocked function called");
    });
    clientMock.configuration = configMock.bind(clientMock);
    clientMock.put = putMock.bind(clientMock);

    const req = {
      url: "https://hull-closeio.herokuapp.com/",
      hull: {
        client: clientMock,
        connector: {}
      }
    };

    statusCheckAction(req, responseMock);
    expect(jsonMock.mock.calls[0][0]).toEqual({
      status: 404,
      messages: ["Request doesn't contain data about the connector"]
    });
  });
});
