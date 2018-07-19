const _ = require("lodash");
const notifierPayload = _.cloneDeep(
  require("../../fixtures/notifier-payloads/user-update.json")
);
const apiResponse = _.cloneDeep(
  require("../../fixtures/api-responses/contact-post.json")
);

module.exports = ctxMock => {
  const usrData = _.get(notifierPayload, "messages[0].user");

  expect(ctxMock.client.asUser.mock.calls[0]).toEqual([usrData]);

  const usrTraits = {
    "closeio/id": { operation: "set", value: _.get(apiResponse, "id") },
    "closeio/name": { operation: "set", value: _.get(usrData, "name") },
    "closeio/email": { operation: "set", value: _.get(usrData, "email") },
    "closeio/description": {
      operation: "set",
      value: _.get(apiResponse, "description")
    },
    "closeio/created_at": {
      operation: "setIfNull",
      value: "2013-03-07T23:23:21.495000+00:00"
    },
    "closeio/updated_at": {
      operation: "set",
      value: "2013-03-07T23:23:21.495000+00:00"
    }
  };

  expect(ctxMock.client.traits.mock.calls[0][0]).toEqual(usrTraits);

  expect(ctxMock.metric.increment.mock.calls).toHaveLength(3);
  expect(ctxMock.metric.increment.mock.calls).toHaveLength(3);
  expect(ctxMock.metric.increment.mock.calls[0]).toEqual([
    "ship.service_api.call",
    1,
    [
      "method:GET",
      "url:https://app.close.io/api/v1/status/lead/",
      "status:200",
      "statusGroup:2xx",
      "endpoint:GET https://app.close.io/api/v1/status/lead/"
    ]
  ]);
  expect(ctxMock.metric.increment.mock.calls[1]).toEqual([
    "ship.service_api.call",
    1,
    [
      "method:GET",
      "url:https://app.close.io/api/v1/custom_fields/lead/",
      "status:200",
      "statusGroup:2xx",
      "endpoint:GET https://app.close.io/api/v1/custom_fields/lead/"
    ]
  ]);
  expect(ctxMock.metric.increment.mock.calls[2]).toEqual([
    "ship.service_api.call",
    1,
    [
      "method:POST",
      "url:https://app.close.io/api/v1/lead/",
      "status:200",
      "statusGroup:2xx",
      "endpoint:POST https://app.close.io/api/v1/lead/"
    ]
  ]);

  expect(ctxMock.client.logger.debug.mock.calls).toHaveLength(3); // debug calls from super-agent
  expect(ctxMock.client.logger.error.mock.calls).toHaveLength(0);

  expect(ctxMock.client.logger.info.mock.calls).toHaveLength(1);
  expect(ctxMock.client.logger.info.mock.calls[0][0]).toEqual(
    "outgoing.user.success"
  );
};
