const _ = require("lodash");
const notifierPayload = _.cloneDeep(
  require("../../fixtures/notifier-payloads/account-update.json")
);
const apiResponse = _.cloneDeep(
  require("../../fixtures/api-responses/lead-post.json")
);

module.exports = ctxMock => {
  const acctData = _.get(notifierPayload, "messages[0].account");

  expect(ctxMock.client.asAccount.mock.calls[0]).toEqual([acctData]);

  const acctTraits = {
    "closeio/id": { operation: "set", value: _.get(apiResponse, "id") },
    "closeio/name": { operation: "set", value: _.get(acctData, "name") },
    "name": { operation: "setIfNull", value: _.get(acctData, "name") },
    "closeio/status": { operation: "set", value: "Potential" },
    "closeio/url": { operation: "set", value: _.get(acctData, "domain") },
    "closeio/description": {
      operation: "set",
      value: _.get(apiResponse, "description")
    },
    "closeio/created_at": {
      operation: "setIfNull",
      value: "2013-02-20T05:30:24.854000+00:00"
    },
    "closeio/updated_at": {
      operation: "set",
      value: "2013-02-20T05:30:24.854000+00:00"
    },
    "closeio/address_office_address_1": {
      operation: "set",
      value: "747 Howard St"
    },
    "closeio/address_office_address_2": {
      operation: "set",
      value: "Room 3"
    },
    "closeio/address_office_city": {
      operation: "set",
      value: "San Francisco"
    },
    "closeio/address_office_country": {
      operation: "set",
      value: "US"
    },
    "closeio/address_office_state": {
      operation: "set",
      value: "CA"
    },
    "closeio/address_office_zipcode": {
      operation: "set",
      value: "94103"
    },
    "closeio/address_business_address_1": {
      operation: "set",
      value: "567 Another Street"
    },
    "closeio/address_business_address_2": {
      operation: "set",
      value: "Suite 32"
    },
    "closeio/address_business_city": {
      operation: "set",
      value: "San Antonio"
    },
    "closeio/address_business_country": {
      operation: "set",
      value: "US"
    },
    "closeio/address_business_state": {
      operation: "set",
      value: "TX"
    },
    "closeio/address_business_zipcode": {
      operation: "set",
      value: "78268"
    },
    "closeio/opportunity_user_id": {
      operation: "set",
      value: "user_1"
    },
    "closeio/opportunity_user_name": {
      operation: "set",
      value: "Bob"
    }
  };

  expect(ctxMock.client.traits.mock.calls[0][0]).toEqual(acctTraits);

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
    "outgoing.account.success"
  );
};
