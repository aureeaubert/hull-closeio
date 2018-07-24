/* @flow */
import type { $Application } from "express";

const cors = require("cors");
const { notifHandler, smartNotifierHandler } = require("hull/lib/utils");

const actions = require("./actions/index");

function server(app: $Application): $Application {
  app.post("/fetch", actions.fetch);
  app.post("/fetch-recent-leads", actions.fetch);

  app.post(
    "/smart-notifier",
    smartNotifierHandler({
      handlers: {
        "user:update": actions.userUpdate,
        "account:update": actions.accountUpdate
      }
    })
  );

  app.post(
    "/batch",
    notifHandler({
      userHandlerOptions: {
        maxSize: 200
      },
      handlers: {
        "user:update": actions.userUpdate
      }
    })
  );

  app.get("/leadstatuses", cors(), actions.fieldsStatus);

  app.get("/admin", actions.adminHandler);

  app.get("/fields-contact-out", cors(), actions.fieldsContactOutbound);
  app.get("/fields-contact-in", cors(), actions.fieldsContactInbound);
  app.get("/fields-lead-in", cors(), actions.fieldsLeadInbound);
  app.get("/fields-lead-out", cors(), actions.fieldsLeadOutbound);
  app.get("/fields-account-ident", cors(), actions.fieldsAccountIdent);

  app.post("/trigger-leads-export", cors(), actions.triggerLeadsExport);

  app.all("/status", actions.statusCheck);

  return app;
}

module.exports = server;
