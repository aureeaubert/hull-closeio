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
  CioMappingUtilSettings
} from "../types";

const _ = require("lodash");
const { URL } = require("url");

const SHARED_MESSAGES = require("../shared-messages");
const { LogicError } = require("hull/lib/errors");

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

  /**
   *Creates an instance of MappingUtil.
   * @param {CioMappingUtilSettings} settings The settings to configure the util.
   * @memberof MappingUtil
   */
  constructor(settings: CioMappingUtilSettings) {
    this.attributeMappings = settings.attributeMappings;
    this.leadCreationStatusId = settings.leadCreationStatusId;
  }

  /**
   * Maps a hull object to the specified close.io object.
   *
   * @template T The type of close.io object.
   * @param {CioObjectType} objType The close.io object type.
   * @param {(THullUser | THullAccount)} hullObject The hull object.
   * @returns {T} The mapped close.io object.
   * @memberof MappingUtil
   */
  mapToServiceObject<T: CioLeadWrite | CioContactWrite>(
    objType: CioObjectType,
    hullObject: THullUser | THullAccount
  ): T {
    if (
      this.attributeMappings === null ||
      _.get(
        this.attributeMappings,
        `${objType.toLowerCase()}_attributes_outbound`,
        []
      ).length === 0 ||
      (_.get(
        this.attributeMappings,
        `${objType.toLowerCase()}_attributes_outbound`,
        []
      ).length === 1 &&
        _.keys(
          _.first(
            _.get(
              this.attributeMappings,
              `${objType.toLowerCase()}_attributes_outbound`,
              []
            )
          )
        ).length === 0)
    ) {
      const errDetail = SHARED_MESSAGES.MAPPING_NOOUTBOUNDFIELDS();
      throw new LogicError(
        errDetail.message,
        "MappingUtil.mapToServiceObject",
        { objType, hullObject }
      );
    }
    const svcObject = {};
    if (objType === "Lead") {
      // Default properties
      svcObject.name = hullObject.name;
      svcObject.url = hullObject.domain;

      if (_.get(hullObject, "closeio/id", null) !== null) {
        svcObject.id = hullObject["closeio/id"];
      } else if (
        _.get(hullObject, "closeio/id", null) === null &&
        this.leadCreationStatusId !== "N/A" &&
        this.leadCreationStatusId !== "hull-default"
      ) {
        svcObject.status_id = this.leadCreationStatusId;
      }
    } else if (objType === "Contact") {
      // Default properties
      svcObject.name = hullObject.name;
      svcObject.lead_id = hullObject["account.closeio/id"] || null;

      if (_.has(hullObject, "traits_closeio/id")) {
        svcObject.id = hullObject["traits_closeio/id"];
      }
    } else {
      const errDetail = SHARED_MESSAGES.MAPPING_UNSUPPORTEDTYPEOUTBOUND(
        objType
      );
      throw new LogicError(
        errDetail.message,
        "MappingUtil.mapToServiceObject",
        { objType, hullObject }
      );
    }

    // Customized mapping
    const mappings = _.get(
      this.attributeMappings,
      `${objType.toLowerCase()}_attributes_outbound`,
      []
    );

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
          if (!_.has(svcObject, arrayAttribName)) {
            svcObject[arrayAttribName] = [];
          }
          const newVal = { type: typeValue };
          _.set(newVal, arrayAttribName.slice(0, -1), hullAttribValue);
          const arrayVal = _.concat(_.get(svcObject, arrayAttribName), newVal);
          svcObject[arrayAttribName] = arrayVal;
        } else {
          // Regular case, just set whatever we get from hull to the field
          svcObject[svcAttribName] = hullAttribValue;
        }
      }
    });

    return svcObject;
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
    ident.domain = this.normalizeUrl(lead.url);
    ident.anonymous_id = `closeio:${lead.id}`;
    return ident;
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
    const mapping = this.attributeMappings.lead_attributes_inbound;
    const hObject: THullAccountAttributes = this.applyMapping(mapping, lead);

    // Ensure that we always set the id from close.io
    if (_.has(lead, "id")) {
      hObject["closeio/id"] = { value: _.get(lead, "id"), operation: "set" };
    }

    // hObject.domain = { value: _.get(sObject, "url"), operation: "setIfNull" });
    hObject["closeio/created_at"] = {
      value: _.get(lead, "date_created"),
      operation: "setIfNull"
    };
    hObject["closeio/updated_at"] = {
      value: _.get(lead, "date_updated"),
      operation: "set"
    };

    return hObject;
  }

  mapContactToHullUserAttributes(contact: CioContactRead): THullUserAttributes {
    const mapping = this.attributeMappings.contact_attributes_inbound;
    const hObject: THullUserAttributes = this.applyMapping(mapping, contact);

    // Ensure that we always set the id from close.io
    if (_.has(contact, "id")) {
      hObject["closeio/id"] = { value: _.get(contact, "id"), operation: "set" };
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
    return mapping.reduce((hullAttrs, m) => {
      if (m === "phones" || m === "emails" || m === "urls") {
        // These are arrays, so we flatten them
        const arrayVal = _.get(serviceObject, m, []);
        _.forEach(arrayVal, v => {
          hullAttrs[`closeio/${m.slice(0, -1)}_${_.get(v, "type")}`] = {
            value: _.get(v, m.slice(0, -1))
          };
        });
      } else if (m === "addresses") {
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
                hullAttrs[`${attribPrefix}_${k}`] = { value: v };
              }
            });
          }
        }
      } else if (m !== "opportunities") {
        // Opps are not supported at the moment
        if (!_.isNil(_.get(serviceObject, m))) {
          hullAttrs[`closeio/${this.getHumanFieldName(m)}`] = {
            value: _.get(serviceObject, m)
          };
        }
      }
      return hullAttrs;
    }, {});
  }

  /**
   * Creates a human readable field name if the field is a custom lead field.
   *
   * @param {string} field The technical name of the field.
   * @returns {string} A human-readable field name.
   * @memberof AttributesMapper
   */
  getHumanFieldName(field: string): string {
    const fieldIds = _.map(this.customFields, c => {
      return c.id;
    });
    let humanName = field;
    if (_.includes(fieldIds, field)) {
      const customField = _.find(this.customFields, c => {
        return c.id === field;
      });
      humanName = _.get(customField, "name");
    }
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
