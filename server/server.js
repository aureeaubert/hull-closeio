/* @flow */
import type { $Application } from "express";

const cors = require("cors");
const { notificationHandler, batchHandler } = require("hull/lib/handlers");
const { credsFromQueryMiddlewares } = require("hull/lib/utils");

const actions = require("./actions/index");

function server(app: $Application): $Application {
  app.post("/fetch", ...credsFromQueryMiddlewares(), actions.fetch);
  app.post(
    "/fetch-recent-leads",
    ...credsFromQueryMiddlewares(),
    actions.fetch
  );

  app.post(
    "/handle-leads-export",
    ...credsFromQueryMiddlewares(),
    actions.handleLeadsExport
  );

  app.post(
    "/smart-notifier",
    notificationHandler({
      "user:update": actions.userUpdate,
      "account:update": actions.accountUpdate
    })
  );

  app.post(
    "/batch",
    batchHandler({
      "user:update": {
        callback: actions.userUpdate,
        options: {
          maxSize: 200
        }
      }
    })
  );

  app.post(
    "/batch-accounts",
    batchHandler({
      "account:update": {
        callback: actions.accountUpdate,
        options: {
          maxSize: 200
        }
      }
    })
  );

  app.get(
    "/leadstatuses",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.fieldsStatus
  );

  app.get("/admin", ...credsFromQueryMiddlewares(), actions.adminHandler);

  app.get(
    "/fields-contact-out",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.fieldsContactOutbound
  );
  app.get(
    "/fields-contact-in",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.fieldsContactInbound
  );
  app.get(
    "/fields-lead-in",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.fieldsLeadInbound
  );
  app.get(
    "/fields-lead-out",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.fieldsLeadOutbound
  );
  app.get(
    "/fields-account-ident",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.fieldsAccountIdent
  );

  app.post(
    "/trigger-leads-export",
    cors(),
    ...credsFromQueryMiddlewares(),
    actions.triggerLeadsExport
  );

  app.all("/status", ...credsFromQueryMiddlewares(), actions.statusCheck);

  return app;
}

module.exports = server;
