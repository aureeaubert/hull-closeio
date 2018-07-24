/* @flow */
import type {
  THullReqContext,
  THullUserUpdateMessage,
  THullAccountUpdateMessage,
  THullConnector
} from "hull";

import type {
  HullMetrics,
  HullClient,
  FilterUtilConfiguration,
  CioMappingUtilSettings,
  CioServiceClientConfiguration,
  CioOutboundMapping,
  CioConnectorSettings,
  HullFieldDropdownItem,
  UserUpdateEnvelope,
  AccountUpdateEnvelope
} from "./types";

const _ = require("lodash");
const { DateTime, Duration } = require("luxon");
// const debug = require("debug")("hull-closeio:sync-agent");

const MappingUtil = require("./sync-agent/mapping-util");
const FilterUtil = require("./sync-agent/filter-util");
const ServiceClient = require("./service-client");
const CONTACT_FIELDDEFS = require("./sync-agent/contact-fielddefs");
const pipeStreamToPromise = require("./support/pipe-stream-to-promise");

const BASE_API_URL = "https://app.close.io/api/v1";

class SyncAgent {
  /**
   * Gets or sets the client to log metrics.
   *
   * @type {THullMetrics}
   * @memberof SyncAgent
   */
  metricsClient: HullMetrics;

  /**
   * Gets or set the hull-node client.
   *
   * @type {THullClient}
   * @memberof SyncAgent
   */
  hullClient: HullClient;

  /**
   * Gets or sets the mapping utility.
   *
   * @type {MappingUtil}
   * @memberof SyncAgent
   */
  mappingUtil: MappingUtil;

  /**
   * Gets or sets the filter utility.
   *
   * @type {FilterUtil}
   * @memberof SyncAgent
   */
  filterUtil: FilterUtil;

  /**
   * Gets or sets the settings of the current connector instance.
   *
   * @type {CioConnectorSettings}
   * @memberof SyncAgent
   */
  normalizedPrivateSettings: CioConnectorSettings;

  /**
   * Gets or sets the client to communicate with
   * the close.io API.
   *
   * @type {ServiceClient}
   * @memberof SyncAgent
   */
  serviceClient: ServiceClient;

  /**
   * Gets or sets the cache manager.
   *
   * @type {Object}
   * @memberof SyncAgent
   */
  cache: Object;

  /**
   * Gets or sets the connector.
   *
   * @type {THullConnector}
   * @memberof SyncAgent
   */
  connector: THullConnector;

  helpers: Object;

  /**
   * Creates an instance of SyncAgent.
   * @param {THullReqContext} reqContext The request context.
   * @memberof SyncAgent
   */
  constructor(reqContext: THullReqContext) {
    // Initialize hull clients
    this.metricsClient = reqContext.metric;
    this.hullClient = reqContext.client;
    // Initialize the cache manager
    this.cache = reqContext.cache;
    // Initialize the connector
    this.connector = reqContext.connector;
    this.helpers = reqContext.helpers;

    // Initialize configuration from settings
    const loadedSettings: CioConnectorSettings = _.get(
      reqContext,
      "ship.private_settings"
    );
    this.normalizedPrivateSettings = this.normalizeSettings(loadedSettings);

    // Configure the filter util
    const configFilterUtil: FilterUtilConfiguration = {
      synchronizedAccountSegments: this.normalizedPrivateSettings
        .synchronized_account_segments,
      leadIdentifierHull: this.normalizedPrivateSettings.lead_identifier_hull
    };
    this.filterUtil = new FilterUtil(configFilterUtil);

    // Configure the service client
    const configServiceClient: CioServiceClientConfiguration = {
      baseApiUrl: BASE_API_URL,
      metricsClient: this.metricsClient,
      loggerClient: this.hullClient.logger,
      apiKey: this.normalizedPrivateSettings.api_key
    };

    this.serviceClient = new ServiceClient(configServiceClient);
  }

  isInitialized(): boolean {
    return this.mappingUtil instanceof MappingUtil;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized() === true) {
      return;
    }

    const leadStatuses = await this.cache.wrap("raw_lead_status", () => {
      return this.serviceClient.getLeadStatuses().then(result => {
        return result.body.data;
      });
    });

    const leadCustomFields = await this.cache.wrap(
      "raw_lead_custom_fields",
      () => {
        return this.serviceClient.getLeadCustomFields().then(result => {
          return result.body.data;
        });
      }
    );

    // Configure the mapping util
    const configMappingUtil: CioMappingUtilSettings = {
      attributeMappings: _.pick(this.normalizedPrivateSettings, [
        "lead_attributes_outbound",
        "lead_attributes_inbound",
        "contact_attributes_outbound",
        "contact_attributes_inbound"
      ]),
      leadCreationStatusId: this.normalizedPrivateSettings.lead_status,
      leadStatuses,
      leadCustomFields,
      leadIdentifierHull: this.normalizedPrivateSettings.lead_identifier_hull,
      leadIdentifierService: this.normalizedPrivateSettings
        .lead_identifier_service
    };
    this.mappingUtil = new MappingUtil(configMappingUtil);
  }

  /**
   * Returns a list of dropdown items for connector settings
   * representing the inbound contact fields.
   *
   * @returns {Array<HullFieldDropdownItem>} The list of dropdown items.
   * @memberof SyncAgent
   */
  getContactFieldOptionsInbound(): Array<HullFieldDropdownItem> {
    const fields = _.filter(CONTACT_FIELDDEFS, { in: true });
    const opts = _.map(fields, f => {
      return { value: f.id, label: f.label };
    });
    return opts;
  }

  /**
   * Returns a list of dropdown items for connector settings
   * representing the outbound contact fields.
   *
   * @returns {Array<HullFieldDropdownItem>} The list of dropdown items.
   * @memberof SyncAgent
   */
  getContactFieldOptionsOutbound(): Array<HullFieldDropdownItem> {
    const fields = _.filter(CONTACT_FIELDDEFS, { out: true });
    const opts = _.map(fields, f => {
      return { value: f.id, label: f.label };
    });
    return opts;
  }

  /**
   * Returns a list of dropdown items for connector settings
   * representing the outbound or inbound lead fields.
   *
   * @param {boolean} [inbound=false] Indicates the direction, by default outbound.
   * @returns {Promise<Array<HullFieldDropdownItem>>} The list of dropdown items.
   * @memberof SyncAgent
   */
  getLeadFields({
    type = "outbound"
  }: Object): Promise<Array<HullFieldDropdownItem>> {
    if (this.isAuthenticationConfigured() === false) {
      return Promise.resolve([]);
    }

    return this.cache.wrap(`lead_custom_fields_${type}`, () => {
      return this.serviceClient
        .getLeadCustomFields()
        .then(listResponse => {
          const customFields = listResponse.body.data.map(f => {
            return { value: `custom.${f.id}`, label: f.name };
          });
          const defaultFields: Array<HullFieldDropdownItem> = [
            { value: "name", label: "Name" },
            { value: "url", label: "Url" },
            { value: "description", label: "Description" }
          ];
          if (type === "inbound") {
            defaultFields.push({
              value: "status_id",
              label: "Status"
            });
          }
          const opts = _.concat(defaultFields, customFields);
          return opts;
        })
        .catch(err => {
          this.hullClient.logger.error("connector.metadata.error", {
            status: err.status,
            message: err.message,
            type: "/fields-lead"
          });
          return [];
        });
    });
  }

  /**
   * Ensure that all settings have sensible defaults
   *
   * @param {CioConnectorSettings} settings The original settings.
   * @returns {CioConnectorSettings} The sanitized settings.
   * @memberof SyncAgent
   */
  normalizeSettings(settings: CioConnectorSettings): CioConnectorSettings {
    const hullId = _.get(settings, "lead_identifier_hull", "domain");
    const svcId = _.get(settings, "lead_identifier_service", "url");
    const leadStatus = _.get(settings, "lead_status", "N/A");
    const leadAttribsOut: Array<CioOutboundMapping> = _.get(
      settings,
      "lead_attributes_outbound",
      []
    );
    const leadAttribsIn: Array<string> = _.get(
      settings,
      "lead_attributes_inbound",
      []
    );
    // Ensure that the identifier for leads is always present
    if (
      _.find(leadAttribsOut, {
        hull_field_name: hullId,
        closeio_field_name: svcId
      }) === undefined
    ) {
      leadAttribsOut.push({
        hull_field_name: hullId,
        closeio_field_name: svcId
      });
    }

    if (_.indexOf(leadAttribsIn, svcId) === -1) {
      leadAttribsIn.push(svcId);
    }

    const finalSettings: CioConnectorSettings = _.cloneDeep(settings);
    finalSettings.lead_attributes_outbound = leadAttribsOut;
    finalSettings.lead_attributes_inbound = leadAttribsIn;
    finalSettings.lead_identifier_hull = hullId;
    finalSettings.lead_identifier_service = svcId;
    finalSettings.lead_status = leadStatus;

    return finalSettings;
  }

  /**
   * Returns a list of dropdown items for connector settings
   * representing the available lead status.
   *
   * @returns {Promise<Array<HullFieldDropdownItem>>} The list of dropdown items.
   * @memberof SyncAgent
   */
  getLeadStatus(): Promise<Array<HullFieldDropdownItem>> {
    if (this.isAuthenticationConfigured() === false) {
      return Promise.resolve([]);
    }

    return this.cache.wrap("leadstatus", () => {
      return this.serviceClient
        .getLeadStatuses()
        .then(response => {
          const status = response.body.data.map(s => {
            return { value: s.id, label: s.label };
          });
          status.unshift({ value: "N/A", label: "(Use default)" });
          return status;
        })
        .catch(err => {
          this.hullClient.logger.error("connector.metadata.error", {
            status: err.status,
            message: err.message,
            type: "/leadstatus"
          });
          return [];
        });
    });
  }

  /**
   * Fetches all updated leads from close.io.
   *
   * @returns {Promise<any[]>} The list of updated leads.
   * @memberof Agent
   */
  async fetchUpdatedLeads(): Promise<any> {
    await this.initialize();
    const safetyInterval = Duration.fromObject({ minutes: 5 });
    let lastSyncAtRaw = parseInt(
      this.normalizedPrivateSettings.last_sync_at,
      10
    );
    if (_.isNaN(lastSyncAtRaw)) {
      lastSyncAtRaw = Math.floor(
        DateTime.utc()
          .minus({ days: 2 })
          .toMillis() / 1000
      );
    }
    const since = DateTime.fromMillis(lastSyncAtRaw * 1000).minus(
      safetyInterval
    );

    this.hullClient.logger.info("incoming.job.start", { since: since.toISO() });

    const streamOfUpdatedLeads = this.serviceClient.getLeadsStream(since);

    return pipeStreamToPromise(streamOfUpdatedLeads, leads => {
      this.hullClient.logger.info("incoming.job.progress", {
        leads: leads.length
      });
      return Promise.all(
        leads.map(lead => {
          const hullAccountIdent = this.mappingUtil.mapLeadToHullAccountIdent(
            lead
          );
          const hullAccountAttributes = this.mappingUtil.mapLeadToHullAccountAttributes(
            lead
          );
          const asAccount = this.hullClient.asAccount(hullAccountIdent);

          return asAccount
            .traits(hullAccountAttributes)
            .then(() => {
              asAccount.logger.info(
                "incoming.account.success",
                hullAccountAttributes
              );
              return Promise.all(
                lead.contacts.map(contact => {
                  const hullUserIdent = this.mappingUtil.mapContactToHullUserIdent(
                    contact
                  );
                  const hullUserAttributes = this.mappingUtil.mapContactToHullUserAttributes(
                    contact
                  );
                  const asUser = this.hullClient.asUser(hullUserIdent);
                  return asUser
                    .account(hullAccountIdent)
                    .traits(hullUserAttributes)
                    .then(() => {
                      asUser.logger.info(
                        "incoming.user.success",
                        hullUserAttributes
                      );
                    })
                    .catch(error => {
                      asUser.logger.error("incoming.user.error", error);
                    });
                })
              );
            })
            .catch(error => {
              console.log(error);
              asAccount.logger.error("incoming.account.error", error);
            });
        })
      );
    })
      .then(() => {
        this.helpers.updateSettings({
          last_sync_at: Math.floor(DateTime.utc().toMillis() / 1000)
        });
        this.hullClient.logger.info("incoming.job.success");
      })
      .catch(error => {
        this.hullClient.logger.error("incoming.job.error", { reason: error });
      });
  }

  /**
   * Utility method to build the envelope for user:update messages.
   *
   * @param {THullUserUpdateMessage} message The notification message.
   * @returns {UserUpdateEnvelope} The envelope.
   * @memberof SyncAgent
   */
  async buildUserUpdateEnvelope(
    message: THullUserUpdateMessage
  ): Promise<UserUpdateEnvelope> {
    const combinedUser = _.cloneDeep(message.user);
    combinedUser.account = _.cloneDeep(message.account);

    const cachedCioContactReadId = await this.cache.get(message.user.id);
    const envelope = {};
    envelope.message = message;
    envelope.hullUser = combinedUser;
    envelope.cioContactRead = null;
    envelope.cachedCioContactReadId = cachedCioContactReadId || null;
    envelope.skipReason = null;
    envelope.error = null;

    envelope.cioContactWrite = this.mappingUtil.mapHullUserToContact(envelope);
    return envelope;
  }

  /**
   * Processes the user:update messages and syncs data with close.io.
   *
   * @param {Array<THullUserUpdateMessage>} messages The notification messages to process.
   * @returns {Promise<any>} A promise which wraps the async processing operation.
   * @memberof SyncAgent
   */
  async sendUserMessages(
    messages: Array<THullUserUpdateMessage>
  ): Promise<any> {
    await this.initialize();
    const deduplicatedMessages = this.filterUtil.deduplicateUserUpdateMessages(
      messages
    );
    const envelopes = await Promise.all(
      deduplicatedMessages.map(message => this.buildUserUpdateEnvelope(message))
    );
    const filterResults = this.filterUtil.filterUsers(envelopes);

    filterResults.toSkip.forEach(envelope => {
      this.hullClient
        .asUser(envelope.message.user)
        .logger.info("outgoing.user.skip", envelope.skipReason);
    });

    const updatedEnvelopes = await this.serviceClient.putContactEnvelopes(
      filterResults.toUpdate
    );

    await Promise.all(
      updatedEnvelopes.map(async updatedEnvelope => {
        try {
          if (updatedEnvelope.cioContactRead === null) {
            throw new Error(updatedEnvelope.error || "Unkown error");
          }
          const combinedContact = updatedEnvelope.cioContactRead;
          combinedContact.lead_id = updatedEnvelope.cioContactWrite.lead_id;
          await this.hullClient
            .asUser(updatedEnvelope.message.user)
            .traits(
              this.mappingUtil.mapContactToHullUserAttributes(combinedContact)
            );
          return this.hullClient
            .asUser(updatedEnvelope.message.user)
            .logger.info(
              "outgoing.user.success",
              updatedEnvelope.cioContactWrite
            );
        } catch (error) {
          return this.hullClient
            .asUser(updatedEnvelope.message.user)
            .logger.info("outgoing.user.error", error);
        }
      })
    );

    const insertedEnvelopes = await this.serviceClient.postContactEnvelopes(
      filterResults.toInsert
    );

    await Promise.all(
      insertedEnvelopes.map(async insertedEnvelope => {
        try {
          if (insertedEnvelope.cioContactRead === null) {
            throw new Error(insertedEnvelope.error || "Unkown error");
          }
          const combinedContact = insertedEnvelope.cioContactRead;
          combinedContact.lead_id = insertedEnvelope.cioContactWrite.lead_id;
          await this.hullClient
            .asUser(insertedEnvelope.message.user)
            .traits(
              this.mappingUtil.mapContactToHullUserAttributes(combinedContact)
            );
          await this.cache.set(
            insertedEnvelope.message.id,
            insertedEnvelope.cioContactRead.id
          );
          return this.hullClient
            .asUser(insertedEnvelope.message.user)
            .logger.info(
              "outgoing.user.success",
              insertedEnvelope.cioContactWrite
            );
        } catch (error) {
          return this.hullClient
            .asUser(insertedEnvelope.message.user)
            .logger.info("outgoing.user.error", error);
        }
      })
    );
  }

  /**
   * Utility method to build the envelope for account:update messages.
   *
   * @param {THullAccountUpdateMessage} message The notification message.
   * @returns {AccountUpdateEnvelope} The envelope.
   * @memberof SyncAgent
   */
  async buildAccountUpdateEnvelope(
    message: THullAccountUpdateMessage
  ): Promise<AccountUpdateEnvelope> {
    const cachedCioLeadReadId = await this.cache.get(message.id);
    const envelope = {};
    envelope.message = message;
    envelope.hullAccount = _.cloneDeep(message.account);
    envelope.cachedCioLeadReadId = cachedCioLeadReadId || null;
    envelope.cioLeadRead = null;
    envelope.skipReason = null;
    envelope.error = null;

    envelope.cioLeadWrite = this.mappingUtil.mapHullAccountToLead(envelope);
    return envelope;
  }

  /**
   * Processes the account:update messages and syncs data with close.io.
   *
   * @param {Array<THullAccountUpdateMessage>} messages The notification messages to process.
   * @returns {Promise<any>} A promise which wraps the async processing operation.
   * @memberof SyncAgent
   */
  async sendAccountMessages(
    messages: Array<THullAccountUpdateMessage>
  ): Promise<any> {
    await this.initialize();
    const deduplicatedMessages = this.filterUtil.deduplicateAccountUpdateMessages(
      messages
    );
    const envelopes = await Promise.all(
      deduplicatedMessages.map(message =>
        this.buildAccountUpdateEnvelope(message)
      )
    );
    const filterResults = this.filterUtil.filterAccounts(envelopes);

    filterResults.toSkip.forEach(envelope => {
      this.hullClient
        .asAccount(envelope.message.account)
        .logger.info("outgoing.account.skip", envelope.skipReason);
    });

    const updatedEnvelopes = await this.serviceClient.putLeadEnvelopes(
      filterResults.toUpdate
    );

    await Promise.all(
      updatedEnvelopes.map(async updatedEnvelope => {
        try {
          if (updatedEnvelope.error !== null) {
            throw new Error(updatedEnvelope.error);
          }
          await this.hullClient
            .asAccount(updatedEnvelope.message.account)
            .traits(
              this.mappingUtil.mapLeadToHullAccountAttributes(
                updatedEnvelope.cioLeadRead
              )
            );
          return this.hullClient
            .asAccount(updatedEnvelope.message.account)
            .logger.info(
              "outgoing.account.success",
              updatedEnvelope.cioLeadWrite
            );
        } catch (error) {
          return this.hullClient
            .asAccount(updatedEnvelope.message.account)
            .logger.info("outgoing.account.error", error);
        }
      })
    );

    const insertedEnvelopes = await this.serviceClient.postLeadEnvelopes(
      filterResults.toInsert
    );

    await Promise.all(
      insertedEnvelopes.map(async insertedEnvelope => {
        try {
          if (insertedEnvelope.error !== null) {
            throw new Error(insertedEnvelope.error);
          }
          await this.hullClient
            .asAccount(insertedEnvelope.message.account)
            .traits(
              this.mappingUtil.mapLeadToHullAccountAttributes(
                insertedEnvelope.cioLeadRead
              )
            );
          await this.cache.set(
            insertedEnvelope.message.id,
            insertedEnvelope.cioLeadRead.id
          );
          return this.hullClient
            .asAccount(insertedEnvelope.message.account)
            .logger.info(
              "outgoing.account.success",
              insertedEnvelope.cioLeadWrite
            );
        } catch (error) {
          return this.hullClient
            .asAccount(insertedEnvelope.message.account)
            .logger.info("outgoing.account.error", insertedEnvelope.error);
        }
      })
    );
  }

  /**
   * Checks whether the API key is provided at all and hypothetically valid.
   *
   * @returns {boolean} True if the API key is present and hypothetically valid; otherwise false.
   * @memberof SyncAgent
   */
  isAuthenticationConfigured(): boolean {
    return this.serviceClient.hasValidApiKey();
  }
}

module.exports = SyncAgent;
