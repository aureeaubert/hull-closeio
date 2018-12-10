const SHARED_MESSAGES = {
  MAPPING_UNSUPPORTEDTYPEOUTBOUND: unsupportedType => {
    return {
      id: "MappingUnsupportedTypeOutbound",
      message: `Failed to map Hull object to unsupported type '${unsupportedType}'.`,
      level: "Error",
      channel: "Operation",
      category: "DataTransformation"
    };
  },
  MAPPING_NOOUTBOUNDFIELDS: () => {
    return {
      id: "MappingNoOutboundFields",
      message:
        "The mapping utility hasn't been initialized with any field mappings.",
      level: "Error",
      channel: "Operation",
      category: "DataTransformation"
    };
  },
  OPERATION_SKIP_NOLEADIDENT: attribName => {
    return {
      id: "OperationSkipAccountNoServiceIdentValue",
      message: `The Hull account has no value for the unique identifier attribute '${attribName}'`,
      level: "Information",
      channel: "Operation",
      category: "DataFlow"
    };
  },
  OPERATION_SKIP_NOMATCHACCOUNTSEGMENTS: () => {
    return {
      id: "OperationSkipAccountNotMatchingSegments",
      message:
        "The Hull account is not part of any whitelisted segment and won't be synchronized with close.io.",
      level: "Information",
      channel: "Operation",
      category: "DataFlow"
    };
  },
  OPERATION_SKIP_NOMATCHACCOUNTSEGMENTSUSER: () => {
    return {
      id: "OperationSkipAccountNotMatchingSegmentsUser",
      message:
        "The linked Hull account is not part of any whitelisted segment, the user won't be synchronized as contact to close.io.",
      level: "Information",
      channel: "Operation",
      category: "DataFlow"
    };
  },
  OPERATION_SKIP_NOLINKEDACCOUNT: () => {
    return {
      id: "OperationSkipUserNotLinkedToAccount",
      message:
        "The Hull user is not linked to an account; cannot create a contact in close.io without a lead.",
      level: "Information",
      channel: "Operation",
      category: "DataFlow"
    };
  },
  OPERATION_SKIP_ACCOUNTDOESNTEXISTINCLOSEIO: () => {
    return {
      id: "OperationSkipAccountDoesntExistInCloseio",
      message:
        "The Hull account doesn't exist in closeio, we can't update it.",
      level: "Information",
      channel: "Operation",
      category: "DataFlow"
    };
  },
  STATUS_ERROR_NOAPIKEY: () => {
    return {
      id: "StatusNoApiKeyConfigured",
      message: "Cannot communicate with API because no API key is configured.",
      level: "Error",
      channel: "Configuration",
      category: "Authentication"
    };
  },
  STATUS_WARNING_NOSEGMENTS: () => {
    return {
      id: "StatusNoSegmentsWhitelisted",
      message:
        "No data will be sent from Hull to close.io due to missing segments configuration.",
      level: "Warning",
      channel: "Configuration",
      category: "DataFlow"
    };
  }
};

module.exports = SHARED_MESSAGES;
