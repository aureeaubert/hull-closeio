const _ = require("lodash");
const payloadLeads = require("../../fixtures/api-responses/list-leads.json");
const payloadStatus = require("../../fixtures/api-responses/list-leadstatus.json");
const payloadFields = require("../../fixtures/api-responses/list-leadfields.json");
const payloadEmail = require("../../fixtures/api-responses/activity-email-get.json");

module.exports = nock => {
  nock("https://app.close.io/")
    .get(/\/api\/v1\/status\/lead\//)
    .reply(200, payloadStatus);

  nock("https://app.close.io/")
    .get(/\/api\/v1\/custom_fields\/lead\//)
    .reply(200, payloadFields);

  nock("https://app.close.io")
    .get("/api/v1/lead/")
    .query({
      query: "updated >= 2018-07-17T08:21:29",
      _limit: 100,
      _skip: 0
    })
    .reply(200, payloadLeads);
  
  nock("https://app.close.io/")
    .get(/\/api\/v1\/activity\/email\//)
    .reply(200, payloadEmail);
};
