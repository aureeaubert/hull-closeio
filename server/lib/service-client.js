/* @flow */
import type { Readable } from "stream";
import type {
  UserUpdateEnvelope,
  AccountUpdateEnvelope,
  HullMetrics,
  HullClientLogger,
  CioListResponse,
  CioLeadCustomField,
  CioLeadStatus,
  CioLeadWrite,
  CioLeadRead,
  CioContactWrite,
  CioContactRead,
  CioServiceClientConfiguration,
  SuperAgentResponse
} from "./types";

const _ = require("lodash");
const { DateTime } = require("luxon");
const debug = require("debug")("hull-closeio:service-client");
const { promiseToReadableStream } = require("hull/lib/utils");
const JSONStream = require("JSONStream");
const unzip = require("unzip-stream");

const superagent = require("superagent");
const SuperagentThrottle = require("superagent-throttle");
const prefixPlugin = require("superagent-prefix");

const {
  superagentUrlTemplatePlugin,
  superagentInstrumentationPlugin,
  superagentErrorPlugin
} = require("hull/lib/utils");
const { ConfigurationError } = require("hull/lib/errors");

const throttlePool = {};

class ServiceClient {
  /**
   * Gets or sets the url prefix for all API calls.
   *
   * @type {string}
   * @memberof ServiceClient
   */
  urlPrefix: string;

  /**
   * Gets or sets the instance of superagent to use for API calls.
   *
   * @type {superagent}
   * @memberof ServiceClient
   */
  agent: superagent;

  /**
   * Gets or sets the client for logging metrics.
   *
   * @type {HullMetrics}
   * @memberof ServiceClient
   */
  metricsClient: HullMetrics;

  /**
   * Gets or sets the client for connector logging.
   *
   * @type {HullClientLogger}
   * @memberof ServiceClient
   */
  loggerClient: HullClientLogger;

  /**
   * Gets or sets the API key to authenticate against
   * the close.io API.
   *
   * @type {string}
   * @memberof CloseIoClient
   */
  apiKey: string;

  /**
   *Creates an instance of ServiceClient.
   * @param {CioServiceClientConfiguration} config The configuration to set up the client.
   * @memberof ServiceClient
   */
  constructor(config: CioServiceClientConfiguration) {
    this.urlPrefix = config.baseApiUrl;
    this.apiKey = config.apiKey;
    this.loggerClient = config.loggerClient;
    this.metricsClient = config.metricsClient;

    throttlePool[this.apiKey] =
      throttlePool[this.apiKey] ||
      new SuperagentThrottle({
        rate: parseInt(process.env.THROTTLE_RATE, 10) || 40, // how many requests can be sent every `ratePer`
        ratePer: parseInt(process.env.THROTTLE_RATE_PER, 10) || 1000 // number of ms in which `rate` requests may be sent
      });

    const throttle = throttlePool[this.apiKey];

    this.agent = superagent
      .agent()
      .use(prefixPlugin(this.urlPrefix))
      .use(throttle.plugin())
      .redirects(0)
      .use(superagentErrorPlugin({ timeout: 10000 }))
      .use(superagentUrlTemplatePlugin())
      .use(
        superagentInstrumentationPlugin({
          logger: this.loggerClient,
          metric: this.metricsClient
        })
      )
      .on("response", res => {
        const limit = _.get(res.header, "x-rate-limit-limit");
        const remaining = _.get(res.header, "x-rate-limit-remaining");
        // const reset = _.get(res.header, "x-rate-limit-reset");
        if (remaining !== undefined) {
          this.metricsClient.value("ship.service_api.remaining", remaining);
        }

        if (limit !== undefined) {
          this.metricsClient.value("ship.service_api.limit", limit);
        }
      })
      .set({ "Content-Type": "application/json" })
      .auth(this.apiKey, "")
      .ok(res => res.status === 200); // we reject the promise for all non 200 responses
  }

  /**
   * Lists or searches all leads that match the given parameters.
   *
   * @param {string} query The query to narrow down the results.
   * @param {number} [limit=100] The number of records per page.
   * @param {number} [skip=0] The number of records to skip.
   * @returns {Promise<CioListResponse<CioLead>>} The list response.
   * @memberof ServiceClient
   */
  getLeads(
    query: string,
    limit: number = 100,
    skip: number = 0
  ): Promise<SuperAgentResponse<CioListResponse<CioLeadRead>>> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }
    debug("getLeads", query);
    return this.agent.get("/lead/").query({
      query,
      _limit: limit,
      _skip: skip
    });
  }

  /**
   * Fetches all updated leads from close.io.
   *
   * @returns {Promise<any[]>} The list of updated leads.
   * @memberof Agent
   */
  getLeadsStream(since: DateTime): Readable {
    const updatedAfter = since.toISODate();
    const q = `updated >= ${updatedAfter}`;
    return promiseToReadableStream(push => {
      return this.getLeads(q, 100, 0).then(res => {
        push(res.body.data);
        const apiOps = [];
        if (
          res.body.has_more === true &&
          res.body.total_results !== undefined
        ) {
          const totalPages = Math.ceil(res.body.total_results / 100);
          for (let page = 1; page < totalPages; page += 1) {
            // eslint-disable-line no-plusplus
            apiOps.push(this.getLeads(q, 100, page * 100));
          }
        }
        return Promise.all(apiOps).then(results => {
          results.forEach(result => {
            push(result.body.data);
          });
        });
      });
    });
  }

  /**
   * Creates a new lead in close.io.
   *
   * @param {CioLead} data The close.io object data.
   * @returns {Promise<CioLead>} The data of the created close.io object.
   * @memberof ServiceClient
   */
  postLead(data: CioLeadWrite): Promise<CioLeadRead> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }

    return this.agent.post("/lead/").send(data);
  }

  postLeadEnvelopes(
    envelopes: Array<AccountUpdateEnvelope>
  ): Promise<Array<AccountUpdateEnvelope>> {
    return Promise.all(
      envelopes.map(envelope => {
        const enrichedEnvelope = _.cloneDeep(envelope);
        return this.postLead(envelope.cioLeadWrite)
          .then(response => {
            // $FlowFixMe
            enrichedEnvelope.cioLeadRead = response.body;
            return enrichedEnvelope;
          })
          .catch(error => {
            enrichedEnvelope.error = error.response.body;
            return enrichedEnvelope;
          });
      })
    );
  }

  /**
   * Updates an exisitng lead in close.io.
   *
   * @param {CioLead} data The close.io object data.
   * @returns {Promise<CioLead>} The data of the updated close.io object.
   * @memberof ServiceClient
   */
  putLead(data: CioLeadWrite): Promise<CioLeadRead> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }

    if (data.id === undefined) {
      return Promise.reject(new Error("Cannot update lead without id"));
    }

    return this.agent.put(`/lead/${data.id}/`).send(data);
  }

  putLeadEnvelopes(
    envelopes: Array<AccountUpdateEnvelope>
  ): Promise<Array<AccountUpdateEnvelope>> {
    return Promise.all(
      envelopes.map(envelope => {
        const enrichedEnvelope = _.cloneDeep(envelope);
        return this.putLead(envelope.cioLeadWrite)
          .then(response => {
            // $FlowFixMe
            enrichedEnvelope.cioLeadRead = response.body;
            return enrichedEnvelope;
          })
          .catch(error => {
            enrichedEnvelope.error = error.response.body;
            return enrichedEnvelope;
          });
      })
    );
  }

  /**
   * List all lead statuses for the organization.
   *
   * @returns {Promise<CioListResponse<CioLeadStatus>>} The list response.
   * @memberof ServiceClient
   */
  getLeadStatuses(): Promise<
    SuperAgentResponse<CioListResponse<CioLeadStatus>>
  > {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }

    return this.agent.get("/status/lead/");
  }

  /**
   * List all custom fields for the organization.
   *
   * @param {number} [limit=100] The number of records per page.
   * @param {number} [skip=0]The number of records to skip.
   * @returns {Promise<CioListResponse<CioLeadCustomField>>} The list response.
   * @memberof ServiceClient
   */
  getLeadCustomFields(
    limit: number = 100,
    skip: number = 0
  ): Promise<SuperAgentResponse<CioListResponse<CioLeadCustomField>>> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }
    debug("getLeadCustomFields");
    return this.agent
      .get("/custom_fields/lead/")
      .query({ _limit: limit, _skip: skip });
  }

  /**
   * Lists or searches all contacts that match the given parameters.
   *
   * @param {string} query The query to execute.
   * @param {number} [limit=100] The number of records per page.
   * @param {number} [skip=0] The number of records to skip.
   * @returns {Promise<CioListResponse<CioContact>>} The list response.
   * @memberof ServiceClient
   */
  getContacts(
    query: string,
    limit: number = 100,
    skip: number = 0
  ): Promise<CioListResponse<CioContactRead>> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }

    return this.agent.get("/contact/").query({
      query,
      _limit: limit,
      _skip: skip
    });
  }

  /**
   * Create a new contact in close.io.
   *
   * @param {CioContact} data The close.io object data.
   * @returns {Promise<CioContact>} The data of the created close.io object.
   * @memberof ServiceClient
   */
  postContact(data: CioContactWrite): Promise<CioContactRead> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }

    return this.agent.post("/contact/").send(data);
  }

  postContactEnvelopes(
    envelopes: Array<UserUpdateEnvelope>
  ): Promise<Array<UserUpdateEnvelope>> {
    return Promise.all(
      envelopes.map(envelope => {
        const enrichedEnvelope = _.cloneDeep(envelope);
        return this.postContact(envelope.cioContactWrite)
          .then(response => {
            // $FlowFixMe
            enrichedEnvelope.cioContactRead = response.body;
            return enrichedEnvelope;
          })
          .catch(error => {
            enrichedEnvelope.error = error.response.body;
            return enrichedEnvelope;
          });
      })
    );
  }

  /**
   * Updates an existing contact in close.io.
   *
   * @param {CioContact} data The close.io object data.
   * @returns {Promise<CioContact>} The data of the updated close.io object.
   * @memberof ServiceClient
   */
  putContact(data: CioContactWrite): Promise<CioContactRead> {
    if (!this.hasValidApiKey()) {
      return Promise.reject(
        new ConfigurationError("No API key specified in the Settings.", {})
      );
    }

    if (data.id === undefined) {
      return Promise.reject(new Error("Cannot update contact without id"));
    }

    return this.agent.put(`/contact/${data.id}/`).send(data);
  }

  putContactEnvelopes(
    envelopes: Array<UserUpdateEnvelope>
  ): Promise<Array<UserUpdateEnvelope>> {
    return Promise.all(
      envelopes.map(envelope => {
        const enrichedEnvelope = _.cloneDeep(envelope);
        return this.putContact(envelope.cioContactWrite)
          .then(response => {
            // $FlowFixMe
            enrichedEnvelope.cioContactRead = response.body;
            return enrichedEnvelope;
          })
          .catch(error => {
            enrichedEnvelope.error = error.response.body;
            return enrichedEnvelope;
          });
      })
    );
  }

  getExportLead(exportId: string): Promise<*> {
    return this.agent.get(`/export/lead/${exportId}/`);
  }

  postExportLead() {
    return this.agent.post("/export/lead/").send({
      format: "json",
      type: "leads",
      send_done_email: false
    });
  }

  getExportLeadStream(exportId: string): Promise<Readable> {
    return this.getExportLead(exportId)
      .then(response => {
        if (response.body.status !== "done" || !response.body.download_url) {
          return Promise.reject(new Error("Export is not done yet"));
        }
        return this.agent
          .get(response.body.download_url)
          .ok(res => res.status === 302);
      })
      .then(downloadUrlResponse => {
        const downloadUrl = downloadUrlResponse.headers.location;
        return superagent.get(downloadUrl);
      })
      .then(downloadStream => {
        const decoder = JSONStream.parse("*");
        downloadStream.pipe(unzip.Parse()).on("entry", entry => {
          const filePath = entry.path;
          const type = entry.type;
          if (type === "File" && filePath.match(/\.json$/)) {
            entry.pipe(decoder);
            entry.on("error", error => {
              entry.destroy(error);
              decoder.destroy(error);
            });
          } else {
            entry.autodrain();
          }
        });
        return decoder;
      });
  }

  // createExportJsonDecodeStream(): Transform {

  // }

  /**
   * Checks whether the API key is theoretically valid.
   *
   * @returns {boolean} True if the API key might be valid; otherwise false.
   * @memberof CloseIoClient
   */
  hasValidApiKey(): boolean {
    if (_.isNil(this.apiKey)) {
      return false;
    }
    if (
      _.isString(this.apiKey) &&
      this.apiKey.length &&
      this.apiKey.length > 5
    ) {
      return true;
    }
    return false;
  }

  /**
   * Checks whether an API call can be successfully performed
   * with the specified API key.
   *
   * @returns {Promise<boolean>} True if the call succeeded; otherwise false.
   * @memberof ServiceClient
   */
  isAuthenticated(): Promise<boolean> {
    if (this.hasValidApiKey() === false) {
      return Promise.resolve(false);
    }

    return this.agent
      .get("/me")
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }
}

module.exports = ServiceClient;
