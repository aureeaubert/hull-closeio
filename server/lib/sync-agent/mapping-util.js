/* @flow */
import type {
  THullUser,
  THullAccount,
  THullAccountIdent,
  THullUserIdent,
  THullAccountAttributes,
  THullUserAttributes
} from "hull";
import type {
  CioContactRead,
  CioLeadRead,
  CioContactWrite,
  CioLeadWrite,
  CioObjectType,
  CioAttributesMapping,
  CioOutboundMapping,
  CioMappingUtilSettings,
  CioLeadStatus,
  CioEmailRead,
  CioLeadCustomField,
  AccountUpdateEnvelope,
  UserUpdateEnvelope
} from "../types";

const _ = require("lodash");
const { URL } = require("url");
const debug = require("debug")("hull-closeio:mapping-util");

class MappingUtil {
  /**
   * Gets or set the attribute mappings for all object types.
   *
   * @type {CioAttributesMapping}
   * @memberof MappingUtil
   */
  attributeMappings: CioAttributesMapping;

  /**
   * Gets or sets the identifier for the lead creation status.
   * Set to "N/A" if default status shall be used.
   *
   * @type {string}
   * @memberof MappingUtil
   */
  leadCreationStatusId: string;

  leadStatuses: Array<CioLeadStatus>;

  leadCustomFields: Array<CioLeadCustomField>;

  leadIdentifierHull: string;
  leadIdentifierService: string;

  /**
   *Creates an instance of MappingUtil.
   * @param {CioMappingUtilSettings} settings The settings to configure the util.
   * @memberof MappingUtil
   */
  constructor(settings: CioMappingUtilSettings) {
    this.attributeMappings = settings.attributeMappings;
    this.leadCreationStatusId = settings.leadCreationStatusId;
    this.leadStatuses = settings.leadStatuses;
    this.leadCustomFields = settings.leadCustomFields;
    this.leadIdentifierHull = settings.leadIdentifierHull;
    this.leadIdentifierService = settings.leadIdentifierService;
  }

  mapHullAccountToLead(envelope: AccountUpdateEnvelope): CioLeadWrite {
    const hullObject = envelope.hullAccount;
    const svcObject: CioLeadWrite = {};
    // Default properties
    svcObject.name = hullObject.name;
    svcObject.url = hullObject.domain;

    if (_.get(hullObject, "closeio/id", null) !== null) {
      svcObject.id = hullObject["closeio/id"];
    } else if (envelope.cachedCioLeadReadId !== null) {
      svcObject.id = envelope.cachedCioLeadReadId;
    } else if (
      _.get(hullObject, "closeio/id", null) === null &&
      this.leadCreationStatusId !== "N/A" &&
      this.leadCreationStatusId !== "hull-default"
    ) {
      svcObject.status_id = this.leadCreationStatusId;
    }
    const customFields = this.mapCustomFields("Lead", hullObject, svcObject);
    return {
      ...svcObject,
      ...customFields
    };
  }

  mapHullUserToContact(envelope: UserUpdateEnvelope): CioContactWrite {
    const hullObject = envelope.hullUser;
    const svcObject: CioContactWrite = {};
    // Default properties
    svcObject.name = hullObject.name;
    svcObject.lead_id = hullObject.account["closeio/id"] || null;

    if (_.has(hullObject, "traits_closeio/id")) {
      svcObject.id = hullObject["traits_closeio/id"];
    }
    return this.mapCustomFields("Contact", hullObject, svcObject);
  }

  mapCustomFields(
    objType: CioObjectType,
    hullObject: THullAccount | THullUser,
    svcObject: CioLeadWrite | CioContactWrite
  ): CioLeadWrite | CioContactWrite {
    const modifiedSvcObject = _.cloneDeep(svcObject);
    // Customized mapping
    const mappings = (
      this.attributeMappings[`${objType.toLowerCase()}_attributes_outbound`] ||
      []
    ).filter(entry => {
      return entry.hull_field_name && entry.closeio_field_name;
    });

    _.forEach(mappings, (m: CioOutboundMapping) => {
      const hullAttribValue = _.get(hullObject, m.hull_field_name);
      if (!_.isNil(hullAttribValue)) {
        const svcAttribName = _.get(m, "closeio_field_name");
        if (
          _.startsWith(svcAttribName, "emails") ||
          _.startsWith(svcAttribName, "phones") ||
          _.startsWith(svcAttribName, "urls")
        ) {
          const arrayAttribName = _.split(svcAttribName, ".")[0];
          const typeValue = _.split(svcAttribName, ".")[1];
          if (!_.has(modifiedSvcObject, arrayAttribName)) {
            modifiedSvcObject[arrayAttribName] = [];
          }
          const newVal = { type: typeValue };
          _.set(newVal, arrayAttribName.slice(0, -1), hullAttribValue);
          const arrayVal = _.concat(
            _.get(modifiedSvcObject, arrayAttribName),
            newVal
          );
          modifiedSvcObject[arrayAttribName] = arrayVal;
        } else {
          // Regular case, just set whatever we get from hull to the field
          modifiedSvcObject[svcAttribName] = hullAttribValue;
        }
      }
    });
    return modifiedSvcObject;
  }

  mapContactToHullUserIdent(contact: CioContactRead): THullUserIdent {
    const ident = {};
    // We cannot say for sure which email address is the proper one,
    // so stick to anonymous_id
    if (!_.isEmpty(contact.emails)) {
      const email = _.get(_.first(_.get(contact, "emails")), "email");
      ident.email = email;
    }
    ident.anonymous_id = `closeio:${contact.id}`;

    return ident;
  }

  mapLeadToHullAccountIdent(lead: CioLeadRead): THullAccountIdent {
    const ident = {};

    if (
      this.leadIdentifierHull === "domain" &&
      typeof lead[this.leadIdentifierService] === "string"
    ) {
      ident.domain = this.normalizeUrl(lead[this.leadIdentifierService]);
    } else if (this.leadIdentifierHull === "external_id") {
      ident[this.leadIdentifierHull] = lead[this.leadIdentifierService];
      if (typeof lead.url === "string") {
        ident.domain = this.normalizeUrl(lead.url);
      }
    }

    ident.anonymous_id = `closeio:${lead.id}`;
    return ident;
  }

  mapLeadToHullAccountImportObject(lead: CioLeadRead): Object | null {
    const transformedLead = _.cloneDeep(lead);
    _.mapKeys(transformedLead.custom, (value, key) => {
      const customFieldDef = _.find(this.leadCustomFields, { name: key });
      if (customFieldDef) {
        transformedLead[`custom.${customFieldDef.id}`] = value;
      }
    });
    const leadIdent = this.mapLeadToHullAccountIdent(transformedLead);
    const leadAttributes = this.mapLeadToHullAccountAttributes(transformedLead);

    if (!leadIdent.external_id && !leadIdent.domain) {
      return null;
    }

    const leadToImport = {};
    leadToImport.traits = leadAttributes;
    if (leadIdent.external_id) {
      leadToImport.accountId = leadIdent.external_id;
    }

    if (leadIdent.domain) {
      leadToImport.traits.domain = leadIdent.domain;
    }
    return leadToImport;
  }

  mapContactToHullUserImportObject(
    leadToImport: Object,
    contact: CioContactRead
  ): Object | null {
    const contactIdent = this.mapContactToHullUserIdent(contact);
    const contactAttributes = this.mapContactToHullUserAttributes(contact);

    if (!contactIdent.email || !leadToImport.external_id) {
      return null;
    }

    const contactToImport = {};
    contactToImport.traits = contactAttributes;
    contactToImport.accountId = leadToImport.external_id;
    contactToImport.traits.email = contactIdent.email;

    return contactToImport;
  }

  /**
   * Maps a close.io object to an object of traits that can be sent to
   * the Hull platform.
   * Note: This is not a Hull user or account object
   *
   * @param {TResourceType} resource The name of the close.io resource.
   * @param {*} sObject The close.io object.
   * @returns {*} The object containing the information about the traits to set.
   * @memberof AttributesMapper
   */
  mapLeadToHullAccountAttributes(lead: CioLeadRead): THullAccountAttributes {
    const mapping = this.attributeMappings.lead_attributes_inbound || [];
    const hObject: THullAccountAttributes = this.applyMapping(mapping, lead);

    // Ensure that we always set the id from close.io
    if (_.has(lead, "id")) {
      hObject["closeio/id"] = { value: _.get(lead, "id"), operation: "set" };
    }

    // hObject.domain = { value: _.get(sObject, "url"), operation: "setIfNull" });
    if (
      hObject["closeio/name"] &&
      hObject["closeio/name"].value &&
      typeof hObject["closeio/name"].value === "string"
    ) {
      hObject.name = {
        value: hObject["closeio/name"].value,
        operation: "setIfNull"
      };
    }
    hObject["closeio/created_at"] = {
      value: lead.date_created,
      operation: "setIfNull"
    };
    hObject["closeio/updated_at"] = {
      value: lead.date_updated,
      operation: "set"
    };

    return hObject;
  }

  mapContactToHullUserAttributes(contact: CioContactRead): THullUserAttributes {
    const mapping = this.attributeMappings.contact_attributes_inbound || [];
    const hObject: THullUserAttributes = this.applyMapping(mapping, contact);

    // Ensure that we always set the id from close.io
    if (_.has(contact, "id")) {
      hObject["closeio/id"] = { value: _.get(contact, "id"), operation: "set" };
    }

    if (
      hObject["closeio/name"] &&
      hObject["closeio/name"].value &&
      typeof hObject["closeio/name"].value === "string"
    ) {
      hObject.name = {
        value: hObject["closeio/name"].value,
        operation: "setIfNull"
      };
    }

    hObject["closeio/lead_id"] = {
      value: _.get(contact, "lead_id"),
      operation: "set"
    };

    return hObject;
  }

  applyMapping(
    mapping: Array<string>,
    serviceObject: CioLeadRead | CioContactRead
  ): THullAccountAttributes | THullUserAttributes {
    return mapping.reduce(
      (hullAttrs: THullAccountAttributes | THullUserAttributes, m: string) => {
        /* eslint-disable no-case-declarations */
        switch (m) {
          case "phones":
          case "emails":
          case "urls":
            // These are arrays, so we flatten them
            const arrayVal = _.get(serviceObject, m, []);
            _.forEach(arrayVal, v => {
              hullAttrs[`closeio/${m.slice(0, -1)}_${_.get(v, "type")}`] = {
                value: _.get(v, m.slice(0, -1)),
                operation: "set"
              };
            });
            break;
          case "status_id":
            if (serviceObject.status_id !== undefined) {
              const leadStatus = _.find(this.leadStatuses, {
                id: serviceObject.status_id
              });
              if (leadStatus !== undefined) {
                hullAttrs["closeio/status"] = {
                  value: leadStatus.label,
                  operation: "set"
                };
              }
            }
            break;
          case "last_communication_user_id":
            if (!_.isNil(serviceObject.last_email_sent)) {
              hullAttrs["closeio/last_communication_user_id"] = {
                value: serviceObject.last_email_sent.user_id,
                operation: "set"
              };
            }
            break;
          case "last_communication_date":
            if (!_.isNil(serviceObject.last_email_sent)) {
              hullAttrs["closeio/last_communication_date"] = {
                value: serviceObject.last_email_sent.date_sent,
                operation: "set"
              };
            }
            break;
          case "addresses":
            // Multiple addresses are not supported,
            // we only store the first one
            if (_.has(serviceObject, m)) {
              const addresses = _.get(serviceObject, m, []);
              if (addresses.length > 0) {
                const addressData = addresses[0];
                const attribPrefix = `closeio/address_${_.get(
                  addressData,
                  "label",
                  "office"
                )}`;
                _.forIn(addressData, (v, k) => {
                  if (k !== "label") {
                    hullAttrs[`${attribPrefix}_${k}`] = {
                      value: v,
                      operation: "set"
                    };
                  }
                });
              }
            }
            break;
          case "opportunities":
            // Opportunities are not supported at the moment
            break;
          default:
            if (!_.isNil(_.get(serviceObject, m))) {
              hullAttrs[`closeio/${this.getHumanFieldName(m)}`] = {
                value: _.get(serviceObject, m),
                operation: "set"
              };
            }
        }
        /* eslint-enable no-case-declarations */
        return hullAttrs;
      },
      {}
    );
  }

  /**
   * Creates a human readable field name if the field is a custom lead field.
   *
   * @param {string} field The technical name of the field.
   * @returns {string} A human-readable field name.
   * @memberof AttributesMapper
   */
  getHumanFieldName(field: string): string {
    const fieldIds = _.map(this.leadCustomFields, c => {
      return `custom.${c.id}`;
    });
    let humanName = field;
    if (_.includes(fieldIds, field)) {
      const customField = _.find(this.leadCustomFields, c => {
        return `custom.${c.id}` === field;
      });
      humanName = _.get(customField, "name");
    }
    debug("getHumanFieldName", field, humanName);
    return _.snakeCase(humanName);
  }

  /**
   * Normalizes the url by stripping everything
   * except hostname.
   *
   * @param {string} original The original url string.
   * @returns {string} The normalized url.
   * @memberof AttributesMapper
   */
  normalizeUrl(original: string): string {
    try {
      const closeUrl = new URL(original);
      return closeUrl.hostname;
    } catch (error) {
      return original;
    }
  }
}

module.exports = MappingUtil;
