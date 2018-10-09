/* @flow */
import type {
  HullAccount,
  HullUserIdent,
  HullAccountIdent,
  HullUserAttributes,
  HullAccountAttributes,
  HullUser,
  HullUserUpdateMessage,
  HullAccountUpdateMessage
} from "hull";

import type { Readable } from "stream";

/*
 *** Hull Types. Replace when 0.14.0 is released
 */

export type HullMetrics = {
  increment(name: string, value: number, ...params: any[]): void,
  value(name: string, value: number, ...params: any[]): void
};

export type HullClientLogger = {
  log(message: ?any, ...optionalParams: any[]): void,
  info(message: ?any, ...optionalParams: any[]): void,
  warn(message: ?any, ...optionalParams: any[]): void,
  error(message: ?any, ...optionalParams: any[]): void,
  debug(message: ?any, ...optionalParams: any[]): void
};

export type HullClientConfiguration = {
  prefix: string,
  domain: string,
  protocol: string,
  id: string,
  secret: string,
  organization: string,
  version: string
};

export type HullClientApiOptions = {
  timeout: number,
  retry: number
};

export type HullClientUtilTraits = {
  group(user: HullUser | HullAccount): Object,
  normalize(traits: Object): HullUserAttributes
};

export type HullClientUtils = {
  traits: HullClientUtilTraits
};

export type HullClientTraitsContext = {
  source: string
};

export type HullFieldDropdownItem = {
  value: string,
  label: string
};

/**
 * This is an event name which we use when tracking an event
 */
export type HullEventName = string;

/**
 * This is are event's properties which we use when tracking an event
 */
export type HullEventProperties = {
  [HullEventProperty: string]: string
};

/**
 * This is additional context passed with event
 */
export type HullEventContext = {
  location?: {},
  page?: {
    referrer?: string
  },
  referrer?: {
    url: string
  },
  os?: {},
  useragent?: string,
  ip?: string | number
};

export type HullClient = {
  configuration: HullClientConfiguration,
  asUser(ident: HullUserIdent): HullClient,
  asAccount(ident: HullAccountIdent): HullClient,
  logger: HullClientLogger,
  traits(
    attributes: HullUserAttributes | HullAccountAttributes,
    context: HullClientTraitsContext
  ): Promise<any>, // Needs to be refined further
  track(
    event: string,
    properties: HullEventProperties,
    context: HullEventContext
  ): Promise<any>,
  get(
    url: string,
    params?: Object,
    options?: HullClientApiOptions
  ): Promise<any>,
  post(
    url: string,
    params?: Object,
    options?: HullClientApiOptions
  ): Promise<any>,
  put(
    url: string,
    params?: Object,
    options?: HullClientApiOptions
  ): Promise<any>,
  del(
    url: string,
    params?: Object,
    options?: HullClientApiOptions
  ): Promise<any>,
  account(ident: HullAccountIdent): HullClient,
  utils: HullClientUtils
};

/*
 *** Close.io Types, specific to this connector
 */

export type CioObjectType = "Lead" | "Contact";

export type CioCustomFieldType =
  | string
  | number
  | Date
  | Array<string>
  | Array<number>;

export type CioOutboundMapping = {
  hull_field_name: string,
  closeio_field_name: string
};

export type CioConnectorSettings = {
  api_key: string,
  synchronized_account_segments: Array<string>,
  lead_status: string,
  lead_attributes_outbound: Array<CioOutboundMapping>,
  lead_attributes_inbound: Array<string>,
  contact_attributes_outbound: Array<CioOutboundMapping>,
  contact_attributes_inbound: Array<string>,
  lead_identifier_hull: string,
  lead_identifier_service: string,
  last_sync_at: string
};

export type CioAttributesMapping = {
  lead_attributes_outbound: Array<CioOutboundMapping>,
  lead_attributes_inbound: Array<string>,
  contact_attributes_outbound: Array<CioOutboundMapping>,
  contact_attributes_inbound: Array<string>
};

export type CioAddress = {
  label: string,
  address_1: string,
  address_2?: string,
  city: string,
  state?: string,
  zipcode?: string,
  country?: string
};

export type CioPhone = {
  phone: string,
  phone_formatted?: string,
  type: string
};

export type CioEmail = {
  type: string,
  email: string,
  email_lower?: string
};

export type CioLeadWrite = {
  id?: string,
  status_id?: string,
  name: string,
  url: string,
  [string]: CioCustomFieldType
};

export type CioLeadRead = {
  id: string,
  status_id: string,
  status_label: string,
  tasks: Array<any>,
  display_name: string,
  addresses: Array<CioAddress>,
  last_email_sent: CioEmailRead,
  name: string,
  date_updated: Date,
  html_url: string,
  created_by: string,
  organization_id: string,
  url: string,
  opportunities: Array<any>,
  updated_by: string,
  date_created: string,
  description: string,
  [string]: CioCustomFieldType
};

export type CioContactWrite = {
  id?: string,
  lead_id: string,
  name: string,
  title?: string,
  phones?: Array<CioPhone>,
  emails?: Array<CioEmail>
};

export type CioContactRead = {
  id: string,
  lead_id: string,
  name: string,
  title: string,
  phones: Array<CioPhone>,
  emails: Array<CioEmail>
};

export type CioEmailRead = {
  date_sent: Date | null,
  user_id: string
};

export type FilterResults<T> = {
  toSkip: Array<T>,
  toInsert: Array<T>,
  toUpdate: Array<T>,
  toDelete?: Array<T>
};

export type UserUpdateEnvelope = {
  message: HullUserUpdateMessage,
  hullUser: HullUser, // an object taken from message.user but we need to mix in `account` property there
  cioContactWrite: CioContactWrite, // the contact object we want to use to write to API
  cioContactRead: CioContactRead | null, // the contact object we have received from the API
  cachedCioContactReadId: string | null,
  skipReason: string | null,
  error: string | null
};

export type AccountUpdateEnvelope = {
  message: HullAccountUpdateMessage,
  hullAccount: HullAccount, // an object taken from message, to make it work the same as for UserUpdateEnvelope
  cioLeadWrite: CioLeadWrite,
  cioLeadRead: CioLeadRead | null,
  cachedCioLeadReadId: string | null,
  skipReason: string | null,
  error: string | null
};

export type FilterUtilConfiguration = {
  synchronizedAccountSegments: Array<string>,
  leadIdentifierHull: string
};

export type CioServiceClientConfiguration = {
  baseApiUrl: string,
  metricsClient: HullMetrics,
  loggerClient: HullClientLogger,
  apiKey: string
};

export type CioLeadCustomField = {
  id: string,
  name: string,
  type: string,
  date_created?: Date,
  date_updated?: Date,
  created_by?: string,
  updated_by?: string,
  organization_id?: string,
  choices?: Array<string>
};

export type CioLeadStatus = {
  organization_id?: string,
  id: string,
  label: string
};

export type CioListResponse<T> = {
  has_more: boolean,
  data: Array<T>,
  total_results?: number
};

export type CioContactFieldDefinition = {
  id: string,
  label: string,
  in: boolean,
  out: boolean
};

export type CioMappingUtilSettings = {
  attributeMappings: CioAttributesMapping,
  leadCreationStatusId: string,
  leadStatuses: Array<CioLeadStatus>,
  leadCustomFields: Array<CioLeadCustomField>,
  leadIdentifierHull: string,
  leadIdentifierService: string
};

export type SuperAgentResponse<BodyType> = {
  ...Readable,
  body: BodyType,
  accepted: boolean,
  badRequest: boolean,
  charset: string,
  clientError: boolean,
  files: any,
  forbidden: boolean,
  get: (header: string) => string,
  header: any,
  info: boolean,
  noContent: boolean,
  notAcceptable: boolean,
  notFound: boolean,
  ok: boolean,
  redirect: boolean,
  serverError: boolean,
  status: number,
  statusType: number,
  text: string,
  type: string,
  unauthorized: boolean
};
