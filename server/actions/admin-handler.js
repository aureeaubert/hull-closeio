/* @flow */
import type { $Request, $Response } from "express";

const SyncAgent = require("../lib/sync-agent");

function adminHandler(req: $Request, res: $Response) {
  const syncAgent = new SyncAgent(req.hull);
  let pendingExport = null;
  if (req.hull.ship && req.hull.ship.private_settings.pending_export_id) {
    return syncAgent.serviceClient
      .getExportLead(req.hull.ship.private_settings.pending_export_id)
      .then(response => {
        pendingExport = {
          progress: response.body.n_docs_processed,
          total: response.body.n_docs,
          status: response.body.status,
          created_at: response.body.date_created
        };
        console.log("RESPONSE", response.body);
        res.render("home.html", {
          name: "Close.io",
          pendingExport
        });
      });
  }
  return res.render("home.html", {
    name: "Close.io",
    pendingExport
  });
}

module.exports = adminHandler;
