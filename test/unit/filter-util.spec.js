const _ = require("lodash");

const FilterUtil = require("../../server/lib/sync-agent/filter-util");
const baseNotifierPayloadUser = require("../integration/fixtures/notifier-payloads/user-update.json");
const baseNotifierPayloadAccount = require("../integration/fixtures/notifier-payloads/account-update.json");

const SHARED_MESSAGES = require("../../server/lib/shared-messages");

const cacheMock = require("../helper/cache-mock");

describe("FilterUtil", () => {
  it("should identify a lead to insert", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadAccount);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullAccount: _.get(notifierPayload, "messages[0].account"),
      lead: {
        name: _.get(notifierPayload, "messages[0].account.name"),
        "custom.lcf_9TB8XYocaq1GQMK5z7MVyOE7TXS1Cys5VycWwTlRBOZ": _.get(notifierPayload, "messages[0].account.external_id")
      }
    };
    const config = {
      synchronizedAccountSegments: ["59f09bc7f9c5a94af600076d"],
      accountIdHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterAccounts([envelope]);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toSkip).toHaveLength(0);
  });

  it("should identify a lead to update", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadAccount);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullAccount: _.merge(_.get(notifierPayload, "messages[0].account"), { "closeio/id": "lead_534219tidgshk452t38tajfk" }),
      cioLeadWrite: {
        name: _.get(notifierPayload, "messages[0].account.name"),
        "custom.lcf_9TB8XYocaq1GQMK5z7MVyOE7TXS1Cys5VycWwTlRBOZ": _.get(notifierPayload, "messages[0].account.external_id"),
      }
    };
    const config = {
      synchronizedAccountSegments: ["59f09bc7f9c5a94af600076d"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterAccounts([envelope]);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toSkip).toHaveLength(0);
  });

  it("should identify a lead to skip if the hull identifier is not present", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadAccount);
    _.unset(notifierPayload, "messages[0].account.external_id");
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullAccount: _.get(notifierPayload, "messages[0].account"),
      cioLeadWrite: {
        name: _.get(notifierPayload, "messages[0].account.name"),
        "custom.lcf_9TB8XYocaq1GQMK5z7MVyOE7TXS1Cys5VycWwTlRBOZ": _.get(notifierPayload, "messages[0].account.external_id")
      }
    };
    const config = {
      synchronizedAccountSegments: ["59f09bc7f9c5a94af600076d"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterAccounts([envelope]);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toSkip).toHaveLength(1);
    expect(result.toSkip[0].skipReason).toEqual(SHARED_MESSAGES.OPERATION_SKIP_NOLEADIDENT("external_id").message);
  });

  it("should identify a lead to skip if the account is not in a whitelisted segment", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadAccount);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullAccount: _.get(notifierPayload, "messages[0].account"),
      cioLeadWrite: {
        name: _.get(notifierPayload, "messages[0].account.name"),
        "custom.lcf_9TB8XYocaq1GQMK5z7MVyOE7TXS1Cys5VycWwTlRBOZ": _.get(notifierPayload, "messages[0].account.external_id")
      }
    };
    const config = {
      synchronizedAccountSegments: ["someSegmentThatDoesntMatch"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterAccounts([envelope]);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toSkip).toHaveLength(1);
    expect(result.toSkip[0].skipReason).toEqual(SHARED_MESSAGES.OPERATION_SKIP_NOMATCHACCOUNTSEGMENTS().message);
  });

  it("should identify a contact to insert", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadUser);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullUser: _.get(notifierPayload, "messages[0].user"),
      cioContactWrite: {
        name: _.get(notifierPayload, "messages[0].user.name"),
        lead_id: "lead_534219tidgshk452t38tajfk"
      }
    };
    const config = {
      synchronizedAccountSegments: ["59f09bc7f9c5a94af600076d"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterUsers([envelope]);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toSkip).toHaveLength(0);
  });

  it("should identify a contact to update", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadUser);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullUser: _.merge(_.get(notifierPayload, "messages[0].user"), { "traits_closeio/id": "cont_y29g2ohnb3u35hy" }),
      cioContactWrite: {
        name: _.get(notifierPayload, "messages[0].user.name"),
        lead_id: "lead_534219tidgshk452t38tajfk"
      }
    };
    const config = {
      synchronizedAccountSegments: ["59f09bc7f9c5a94af600076d"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterUsers([envelope]);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toSkip).toHaveLength(0);
  });

  it("should identify a contact to skip if not linked to a lead", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadUser);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullUser: _.get(notifierPayload, "messages[0].user"),
      cioContactWrite: {
        name: _.get(notifierPayload, "messages[0].user.name")
      }
    };
    const config = {
      synchronizedAccountSegments: ["59f09bc7f9c5a94af600076d"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterUsers([envelope]);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toSkip).toHaveLength(1);
    expect(result.toSkip[0].skipReason).toEqual(SHARED_MESSAGES.OPERATION_SKIP_NOLINKEDACCOUNT().message);
  });

  it("should identify a contact to skip if linked account is not in matching whitelisted segments", async () => {
    const notifierPayload = _.cloneDeep(baseNotifierPayloadUser);
    const envelope = {
      message: _.get(notifierPayload, "messages[0]"),
      hullUser: _.get(notifierPayload, "messages[0].user"),
      cioContactWrite: {
        name: _.get(notifierPayload, "messages[0].user.name"),
        lead_id: "lead_534219tidgshk452t38tajfk"
      }
    };
    const config = {
      synchronizedAccountSegments: ["segmentThatDoesntMatchFoo"],
      leadIdentifierHull: "external_id",
      cache: cacheMock
    };
    const util = new FilterUtil(config);

    const result = await util.filterUsers([envelope]);
    expect(result.toInsert).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toSkip).toHaveLength(1);
    expect(result.toSkip[0].skipReason).toEqual(SHARED_MESSAGES.OPERATION_SKIP_NOMATCHACCOUNTSEGMENTSUSER().message);
  });
});
