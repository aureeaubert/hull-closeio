/* @flow */
import type { THullUserUpdateMessage, THullAccountUpdateMessage } from "hull";
import type {
  UserUpdateEnvelope,
  AccountUpdateEnvelope,
  FilterResults,
  FilterUtilConfiguration
} from "../types";

const _ = require("lodash");
const Promise = require('bluebird');

const SHARED_MESSAGES = require("../shared-messages");

class FilterUtil {
  /**
   * Gets or sets the synchronized account segments.
   *
   * @type {Array<string>}
   * @memberof FilterUtil
   */
  synchronizedAccountSegments: Array<string>;

  /**
   * Gets or sets the identifier attribute of the hull account.
   *
   * @type {string}
   * @memberof FilterUtil
   */
  leadIdentifierHull: string;

  cache: Object;

  /**
   *Creates an instance of FilterUtil.
   * @param {FilterUtilConfiguration} config The settings to configure the util with.
   * @memberof FilterUtil
   */
  constructor(config: FilterUtilConfiguration) {
    // Configure the util with sensible defaults
    this.synchronizedAccountSegments = config.synchronizedAccountSegments || [];
    this.leadIdentifierHull = config.leadIdentifierHull || "domain";
    this.cache = config.cache;
  }

  /**
   * Filters the list of user envelopes to determine the operation.
   *
   * @param {Array<UserUpdateEnvelope>} envelopes The list of envelopes to filter.
   * @returns {FilterResults<UserUpdateEnvelope>} The filter result.
   * @memberof FilterUtil
   */
  async filterUsers(
    envelopes: Array<UserUpdateEnvelope>
  ): FilterResults<UserUpdateEnvelope> {
    const results: FilterResults<UserUpdateEnvelope> = {
      toSkip: [],
      toInsert: [],
      toUpdate: []
    };

    await Promise.each(envelopes, async (envelope: UserUpdateEnvelope) => {
      // Filter users not linked to accounts that match whitelisted segments
      if (
        !this.matchesSynchronizedAccountSegments(
          envelope,
          "message.account_segments"
        )
      ) {
        const skipMsg = SHARED_MESSAGES.OPERATION_SKIP_NOMATCHACCOUNTSEGMENTSUSER();
        envelope.skipReason = skipMsg.message;
        envelope.opsResult = "skip";
        return results.toSkip.push(envelope);
      }

      const cachedContactCioId = await this.cache.get(envelope.hullUser.id);
      if (
        _.has(envelope.hullUser, "traits_closeio/id")
        || !_.isNil(cachedContactCioId)
      ) {
        envelope.cioContactWrite.id = envelope.hullUser["traits_closeio/id"] || cachedContactCioId;
        return results.toUpdate.push(envelope);
      }

      const skipMsg = SHARED_MESSAGES.OPERATION_SKIP_USERDOESNTEXISTINCLOSEIO();
      envelope.skipReason = skipMsg.message;
      envelope.opsResult = "skip";
      return results.toSkip.push(envelope);
    });
    return results;
  }

  /**
   * Filters the list of account envelopes to determine the appropriate operation.
   *
   * @param {Array<AccountUpdateEnvelope>} envelopes The list of envelopes to filter.
   * @returns {FilterResults<AccountUpdateEnvelope>} The filter result.
   * @memberof FilterUtil
   */
  async filterAccounts(
    envelopes: Array<AccountUpdateEnvelope>
  ): Promise<FilterResults<AccountUpdateEnvelope>> {
    const results: FilterResults<AccountUpdateEnvelope> = {
      toSkip: [],
      toInsert: [],
      toUpdate: []
    };

    await Promise.each(envelopes, async (envelope: AccountUpdateEnvelope) => {
      // Filter out all accounts that do not match the whitelisted account segments
      if (
        !this.matchesSynchronizedAccountSegments(
          envelope,
          "message.account_segments"
        )
      ) {
        const skipMsg = SHARED_MESSAGES.OPERATION_SKIP_NOMATCHACCOUNTSEGMENTS();
        envelope.skipReason = skipMsg.message;
        envelope.opsResult = "skip";
        return results.toSkip.push(envelope);
      }

      const cachedCioLeadId = await this.cache.get(envelope.hullAccount.id);
      if (
        _.has(envelope.hullAccount, "closeio/id")
        || !_.isNil(cachedCioLeadId)
      ) {
        envelope.cioLeadWrite.id = envelope.hullAccount["closeio/id"] || cachedCioLeadId;
        return results.toUpdate.push(envelope);
      }

      const skipMsg = SHARED_MESSAGES.OPERATION_SKIP_ACCOUNTDOESNTEXISTINCLOSEIO();
      envelope.skipReason = skipMsg.message;
      envelope.opsResult = "skip";
      return results.toSkip.push(envelope);
    });

    return results;
  }

  /**
   * Checks whether an envelope matches the synchronized account segments or not.
   *
   * @param {(UserUpdateEnvelope | AccountUpdateEnvelope)} envelope The user or account envelope to check.
   * @param {string} segmentPropertyName The name of the segments property of the message.
   * @returns {boolean} True if the envelope matches; otherwise false.
   * @memberof FilterUtil
   */
  matchesSynchronizedAccountSegments(
    envelope: UserUpdateEnvelope | AccountUpdateEnvelope,
    segmentPropertyName: string = "message.segments"
  ): boolean {
    const msgSegmentIds: Array<string> = _.get(
      envelope,
      segmentPropertyName,
      []
    ).map(s => s.id);
    if (
      _.intersection(msgSegmentIds, this.synchronizedAccountSegments).length > 0
    ) {
      return true;
    }
    return false;
  }

  /**
   * Deduplicates messages by user.id and joins all events into a single message.
   *
   * @param {Array<THullUserUpdateMessage>} messages The list of messages to deduplicate.
   * @returns {Array<THullUserUpdateMessage>} A list of unique messages.
   * @memberof FilterUtil
   */
  deduplicateUserUpdateMessages(
    messages: Array<THullUserUpdateMessage>
  ): Array<THullUserUpdateMessage> {
    return _.chain(messages)
      .groupBy("user.id")
      .map(
        (
          groupedMessages: Array<THullUserUpdateMessage>
        ): THullUserUpdateMessage => {
          const dedupedMessage = _.cloneDeep(
            _.last(_.sortBy(groupedMessages, ["user.indexed_at"]))
          );
          const hashedEvents = {};
          groupedMessages.forEach((m: THullUserUpdateMessage) => {
            _.get(m, "events", []).forEach((e: Object) => {
              _.set(hashedEvents, e.event_id, e);
            });
          });
          dedupedMessage.events = _.values(hashedEvents);
          return dedupedMessage;
        }
      )
      .value();
  }

  deduplicateAccountUpdateMessages(
    messages: Array<THullAccountUpdateMessage>
  ): Array<THullAccountUpdateMessage> {
    return _.chain(messages)
      .groupBy("account.id")
      .map(
        (
          groupedMessages: Array<THullUserUpdateMessage>
        ): THullUserUpdateMessage => {
          const dedupedMessage = _.cloneDeep(
            _.last(_.sortBy(groupedMessages, ["account.indexed_at"]))
          );
          return dedupedMessage;
        }
      )
      .value();
  }
}

module.exports = FilterUtil;
