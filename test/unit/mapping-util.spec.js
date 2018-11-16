const MappingUtil = require("../../server/lib/sync-agent/mapping-util");

describe("MappingUtil", () => {
  test("should initialize mappings and lead creation status if appropriate settings are passed", () => {
    const settings = {
      attributeMappings: {
        lead_attributes_outbound: [
          { hull_field_name: "name", closeio_field_name: "name" }
        ],
        lead_attributes_inbound: [
          "name",
          "custom.lcf_BnhWfopv1iEafpTY2Lcm025IfMboHwWMEhfhh5qsiPQ",
          "custom.lcf_oGeEw9l2BVl1DVARG6jZUJmq8wLkYZN6W7veDk78ZEo",
          "custom.lcf_JzIbH01yGJH4aO5jEMcISvkc5eN5J6eD70Yl59XGBFs",
          "custom.lcf_qdRtQD9yAqeFRyZ7Xw2yJ13EoxFPwnWlQaEl08lGWWU",
          "custom.lcf_1IkLYzfWy9MrjcRgfTTdknTWPGW99sbZ3ITMHnTNGhe"
        ],
        contact_attributes_outbound: [
          {}
        ],
        contact_attributes_inbound: [
          "title",
          "phones",
          "emails",
          "name"
        ]
      },
      leadCreationStatusId: "N/A"
    };

    const util = new MappingUtil(settings);
    expect(util.attributeMappings).toEqual(settings.attributeMappings);
  });

  test("should map an account object to a lead", () => {
    const hullAccount = {
      created_at: "2017-10-25T10:06:00Z",
      domain: "hullsfdc.io",
      employees: 2,
      external_id: "a9461ad518be40ba-b568-4729-a676-f9c55abd72c9",
      industry: "Technology",
      name: "Hull SFDC Testing",
      plan: "Enterprise"
    };

    const settings = {
      attributeMappings: {
        lead_attributes_outbound: [
          { hull_field_name: "name", closeio_field_name: "name" }
        ],
        lead_attributes_inbound: [
          "name",
          "custom.lcf_BnhWfopv1iEafpTY2Lcm025IfMboHwWMEhfhh5qsiPQ",
          "custom.lcf_oGeEw9l2BVl1DVARG6jZUJmq8wLkYZN6W7veDk78ZEo",
          "custom.lcf_JzIbH01yGJH4aO5jEMcISvkc5eN5J6eD70Yl59XGBFs",
          "custom.lcf_qdRtQD9yAqeFRyZ7Xw2yJ13EoxFPwnWlQaEl08lGWWU",
          "custom.lcf_1IkLYzfWy9MrjcRgfTTdknTWPGW99sbZ3ITMHnTNGhe"
        ],
        contact_attributes_outbound: [
          {}
        ],
        contact_attributes_inbound: [
          "title",
          "phones",
          "emails",
          "name"
        ]
      },
      leadCreationStatusId: "N/A"
    };

    const expectedCloseObject = {
      name: hullAccount.name,
      url: hullAccount.domain
    };

    const util = new MappingUtil(settings);

    const svcObject = util.mapHullAccountToLead({ hullAccount });

    expect(svcObject).toEqual(expectedCloseObject);
  });

  test("should map a user object to a contact", () => {
    const hullUser = {
      account: {
        created_at: "2017-10-25T10:06:00Z",
        domain: "hullsfdc.io",
        employees: 2,
        external_id: "a9461ad518be40ba-b568-4729-a676-f9c55abd72c9",
        industry: "Technology",
        name: "Hull SFDC Testing",
        plan: "Enterprise",
        "closeio/id": "lead_1234346798y5369ybdjh"
      },
      id: "59f06a5f421a978e920643d7",
      created_at: "2017-10-25T10:41:35Z",
      is_approved: false,
      has_password: false,
      accepts_marketing: false,
      email: "sven+sfdc4@hull.io",
      domain: "hull.io",
      name: "Sven4 SFDC",
      last_name: "SFDC",
      first_name: "Svn4",
      traits_status: "Lead",
      "traits_intercom/citygroup": "Stuttgart",
      traits_company: "Hull Test SFDC GmbH & Co KG",
      "traits_salesforce_lead/id": "abcdf",
      "traits_salesforce_contact/id": "1234foo",
      "traits_salesforce/id": "56789baz"
    };

    const settings = {
      attributeMappings: {
        lead_attributes_outbound: [
          { hull_field_name: "name", closeio_field_name: "name" }
        ],
        lead_attributes_inbound: [
          "name",
          "custom.lcf_BnhWfopv1iEafpTY2Lcm025IfMboHwWMEhfhh5qsiPQ",
          "custom.lcf_oGeEw9l2BVl1DVARG6jZUJmq8wLkYZN6W7veDk78ZEo",
          "custom.lcf_JzIbH01yGJH4aO5jEMcISvkc5eN5J6eD70Yl59XGBFs",
          "custom.lcf_qdRtQD9yAqeFRyZ7Xw2yJ13EoxFPwnWlQaEl08lGWWU",
          "custom.lcf_1IkLYzfWy9MrjcRgfTTdknTWPGW99sbZ3ITMHnTNGhe"
        ],
        contact_attributes_outbound: [
          { hull_field_name: "name", closeio_field_name: "name" }
        ],
        contact_attributes_inbound: [
          "title",
          "phones",
          "emails",
          "name"
        ]
      },
      leadCreationStatusId: "N/A"
    };

    const expectedCloseObject = {
      name: hullUser.name,
      lead_id: hullUser.account["closeio/id"]
    };

    const util = new MappingUtil(settings);

    const svcObject = util.mapHullUserToContact({ hullUser });

    expect(svcObject).toEqual(expectedCloseObject);
  });
});
