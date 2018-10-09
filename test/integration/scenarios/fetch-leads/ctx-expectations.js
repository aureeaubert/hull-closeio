const payloadLeads = require("../../fixtures/api-responses/list-leads.json");

module.exports = ctxMock => {
  const customFieldIdWithExternalId = "custom.lcf_9TB8XYocaq1GQMK5z7MVyOE7TXS1Cys5VycWwTlRBOZ";
  const leadData = payloadLeads.data[0];
  const expectedAccountIdent = {
    external_id: leadData[customFieldIdWithExternalId],
    domain: leadData.url.replace("http://", ""),
    anonymous_id: `closeio:${leadData.id}`
  };
  const accountTraits = {
    name: {
      value: leadData.name,
      operation: "setIfNull"
    },
    "closeio/name": {
      value: leadData.name,
      operation: "set"
    },
    "closeio/accounting_software": {
      value: leadData.custom["Accounting Software"],
      operation: "set"
    },
    "closeio/company_id": {
      value: leadData.custom["Company ID"],
      operation: "set"
    },
    "closeio/customer_success": {
      value: leadData.custom["Customer Success"],
      operation: "set"
    },
    "closeio/fit_score": {
      value: leadData.custom["Fit Score"],
      operation: "set"
    },
    "closeio/ft_es": {
      value: leadData.custom["FTEs"],
      operation: "set"
    },
    "closeio/industry": {
      value: leadData.custom["Industry"],
      operation: "set"
    },
    "closeio/onboarding_manager": {
      value: leadData.custom["Onboarding Manager"],
      operation: "set"
    },
    "closeio/onboarding_use_case": {
      value: leadData.custom["Onboarding use case"],
      operation: "set"
    },
    "closeio/reason_of_loss": {
      value: leadData.custom["Reason of Loss"],
      operation: "set"
    },
    "closeio/salesloft": {
      value: leadData.custom["Salesloft"],
      operation: "set"
    },
    "closeio/description": {
      value: leadData.description,
      operation: "set"
    },
    "closeio/url": {
      value: leadData.url,
      operation: "set"
    },
    "closeio/id": {
      value: leadData.id,
      operation: "set"
    },
    "closeio/created_at": {
      value: leadData.date_created,
      operation: "setIfNull"
    },
    "closeio/updated_at": {
      value: leadData.date_updated,
      operation: "set"
    },
    "closeio/last_communication_user_id": {
      operation: "set",
      value: "user_1234"
    }
  };
  expect(ctxMock.client.asAccount.mock.calls[0]).toEqual([expectedAccountIdent]);
  expect(ctxMock.client.traits.mock.calls[0]).toEqual([accountTraits]);

  expect(ctxMock.client.account.mock.calls[0]).toEqual([expectedAccountIdent]);
  expect(ctxMock.client.account.mock.calls[1]).toEqual([expectedAccountIdent]);

  const firstContactData = leadData.contacts[0];

  const firstUserIdent = {
    email: firstContactData.emails[0].email,
    anonymous_id: `closeio:${firstContactData.id}`
  };
  expect(ctxMock.client.asUser.mock.calls[0]).toEqual([firstUserIdent]);
  const firstUserTraits = {
    name: {
      value: firstContactData.name,
      operation: "setIfNull"
    },
    "closeio/title": {
      value: firstContactData.title,
      operation: "set"
    },
    "closeio/phone_office": {
      value: firstContactData.phones[0].phone,
      operation: "set"
    },
    "closeio/email_office": {
      value: firstContactData.emails[0].email,
      operation: "set"
    },
    "closeio/name": {
      value: firstContactData.name,
      operation: "set"
    },
    "closeio/id": {
      value: firstContactData.id,
      operation: "set"
    },
    "closeio/lead_id": {
      value: firstContactData.lead_id,
      operation: "set"
    }
  };
  expect(ctxMock.client.traits.mock.calls[1]).toEqual([firstUserTraits]);
};
