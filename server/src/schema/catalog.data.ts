// AUTO-GENERATED from veridian-wallet credential-server schemas.
// Verbatim, pre-saidified ACDC schemas served as the importable catalog.

export interface CatalogSchema {
  said: string;
  title: string;
  credentialType: string;
  fields: string[];
  schema: Record<string, unknown>;
}

export const CATALOG_SCHEMAS: CatalogSchema[] = [
  {
    "said": "EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao",
    "title": "Qualified vLEI Issuer Credential",
    "credentialType": "QualifiedvLEIIssuervLEICredential",
    "fields": [
      "LEI",
      "gracePeriod"
    ],
    "schema": {
      "$id": "EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao",
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "Qualified vLEI Issuer Credential",
      "description": "A vLEI Credential issued by GLEIF to Qualified vLEI Issuers which allows the Qualified vLEI Issuers to issue, verify and revoke Legal Entity vLEI Credentials and Legal Entity Official Organizational Role vLEI Credentials",
      "type": "object",
      "credentialType": "QualifiedvLEIIssuervLEICredential",
      "version": "1.0.0",
      "properties": {
        "v": {
          "description": "Version",
          "type": "string"
        },
        "d": {
          "description": "Credential SAID",
          "type": "string"
        },
        "u": {
          "description": "One time use nonce",
          "type": "string"
        },
        "i": {
          "description": "GLEIF Issuee AID",
          "type": "string"
        },
        "ri": {
          "description": "Credential status registry",
          "type": "string"
        },
        "s": {
          "description": "Schema SAID",
          "type": "string"
        },
        "a": {
          "oneOf": [
            {
              "description": "Attributes block SAID",
              "type": "string"
            },
            {
              "$id": "ELGgI0fkloqKWREXgqUfgS0bJybP1LChxCO3sqPSFHCj",
              "description": "Attributes block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Attributes block SAID",
                  "type": "string"
                },
                "i": {
                  "description": "QVI Issuee AID",
                  "type": "string"
                },
                "dt": {
                  "description": "Issuance date time",
                  "type": "string",
                  "format": "date-time"
                },
                "LEI": {
                  "description": "LEI of the requesting Legal Entity",
                  "type": "string",
                  "format": "ISO 17442"
                },
                "gracePeriod": {
                  "description": "Allocated grace period",
                  "type": "integer",
                  "default": 90
                }
              },
              "additionalProperties": false,
              "required": [
                "i",
                "dt",
                "LEI"
              ]
            }
          ]
        },
        "r": {
          "oneOf": [
            {
              "description": "Rules block SAID",
              "type": "string"
            },
            {
              "$id": "ECllqarpkZrSIWCb97XlMpEZZH3q4kc--FQ9mbkFMb_5",
              "description": "Rules block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Rules block SAID",
                  "type": "string"
                },
                "usageDisclaimer": {
                  "description": "Usage Disclaimer",
                  "type": "object",
                  "properties": {
                    "l": {
                      "description": "Associated legal language",
                      "type": "string",
                      "const": "Usage of a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, does not assert that the Legal Entity is trustworthy, honest, reputable in its business dealings, safe to do business with, or compliant with any laws or that an implied or expressly intended purpose will be fulfilled."
                    }
                  }
                },
                "issuanceDisclaimer": {
                  "description": "Issuance Disclaimer",
                  "type": "object",
                  "properties": {
                    "l": {
                      "description": "Associated legal language",
                      "type": "string",
                      "const": "All information in a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, is accurate as of the date the validation process was complete. The vLEI Credential has been issued to the legal entity or person named in the vLEI Credential as the subject; and the qualified vLEI Issuer exercised reasonable care to perform the validation process set forth in the vLEI Ecosystem Governance Framework."
                    }
                  }
                }
              },
              "additionalProperties": false,
              "required": [
                "d",
                "usageDisclaimer",
                "issuanceDisclaimer"
              ]
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "i",
        "ri",
        "s",
        "d"
      ]
    }
  },
  {
    "said": "EJxnJdxkHbRw2wVFNe4IUOPLt8fEtg9Sr3WyTjlgKoIb",
    "title": "Rare EVO 2024 Attendee",
    "credentialType": "RareEvo2024AttendeeCredential",
    "fields": [
      "attendeeName"
    ],
    "schema": {
      "$id": "EJxnJdxkHbRw2wVFNe4IUOPLt8fEtg9Sr3WyTjlgKoIb",
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "Rare EVO 2024 Attendee",
      "description": "This Trust Over IP (ToIP) Authentic Chained Data Container (ACDC) Credential provides an end-verifiable attestation that the holder attended the Rare EVO event on August 15 - 17, 2024, and participated in the Cardano Foundation's Identity Wallet demonstration leveraging Key Event Receipt Infrastructure (KERI).",
      "type": "object",
      "credentialType": "RareEvo2024AttendeeCredential",
      "version": "1.0.0",
      "properties": {
        "v": {
          "description": "Version",
          "type": "string"
        },
        "d": {
          "description": "Credential SAID",
          "type": "string"
        },
        "u": {
          "description": "One time use nonce",
          "type": "string"
        },
        "i": {
          "description": "Issuee AID",
          "type": "string"
        },
        "ri": {
          "description": "Credential status registry",
          "type": "string"
        },
        "s": {
          "description": "Schema SAID",
          "type": "string"
        },
        "a": {
          "oneOf": [
            {
              "description": "Attributes block SAID",
              "type": "string"
            },
            {
              "$id": "EMNYoCwqUTqRgqqYh4Wg5UuLSr7PncFZ6RUx1vdnqxJs",
              "description": "Attributes block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Attributes block SAID",
                  "type": "string"
                },
                "i": {
                  "description": "Issuee AID",
                  "type": "string"
                },
                "dt": {
                  "description": "Issuance date time",
                  "type": "string",
                  "format": "date-time"
                },
                "attendeeName": {
                  "description": "The name of the attendee",
                  "type": "string"
                }
              },
              "additionalProperties": false,
              "required": [
                "i",
                "dt",
                "attendeeName"
              ]
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "i",
        "ri",
        "s",
        "d"
      ]
    }
  },
  {
    "said": "EKA57bKBKxr_kN7iN5i7lMUxpMG-s19dRcmov1iDxz-E",
    "title": "OOR Authorization vLEI Credential",
    "credentialType": "OORAuthorizationvLEICredential",
    "fields": [
      "AID",
      "LEI",
      "personLegalName",
      "officialRole"
    ],
    "schema": {
      "$id": "EKA57bKBKxr_kN7iN5i7lMUxpMG-s19dRcmov1iDxz-E",
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "OOR Authorization vLEI Credential",
      "description": "A vLEI Authorization Credential issued by a Legal Entity to a QVI for the authorization of OOR credentials",
      "type": "object",
      "credentialType": "OORAuthorizationvLEICredential",
      "version": "1.0.0",
      "properties": {
        "v": {
          "description": "Version",
          "type": "string"
        },
        "d": {
          "description": "Credential SAID",
          "type": "string"
        },
        "u": {
          "description": "One time use nonce",
          "type": "string"
        },
        "i": {
          "description": "LE Issuer AID",
          "type": "string"
        },
        "ri": {
          "description": "Credential status registry",
          "type": "string"
        },
        "s": {
          "description": "Schema SAID",
          "type": "string"
        },
        "a": {
          "oneOf": [
            {
              "description": "Attributes block SAID",
              "type": "string"
            },
            {
              "$id": "EPli-kppZ4gj8g4i3-FUx3ZG1H_UrMhXwzyP1E6uAot6",
              "description": "Attributes block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Attributes block SAID",
                  "type": "string"
                },
                "i": {
                  "description": "QVI Issuee AID",
                  "type": "string"
                },
                "dt": {
                  "description": "Issuance date time",
                  "format": "date-time",
                  "type": "string"
                },
                "AID": {
                  "description": "AID of the intended recipient of the ECR credential",
                  "type": "string"
                },
                "LEI": {
                  "description": "LEI of the requesting Legal Entity",
                  "type": "string",
                  "format": "ISO 17442"
                },
                "personLegalName": {
                  "description": "Requested recipient name as provided during identity assurance",
                  "type": "string"
                },
                "officialRole": {
                  "description": "Requested role description i.e. 'Head of Standards'",
                  "type": "string"
                }
              },
              "additionalProperties": false,
              "required": [
                "i",
                "dt",
                "AID",
                "LEI",
                "personLegalName",
                "officialRole"
              ]
            }
          ]
        },
        "e": {
          "oneOf": [
            {
              "description": "Edges block SAID",
              "type": "string"
            },
            {
              "$id": "EB6E1GJvVen5NqkKb2TG5jqX66vYOL3md-xkXQqQBySX",
              "description": "Edges block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Edges block SAID",
                  "type": "string"
                },
                "le": {
                  "description": "Chain to legal entity vLEI credential",
                  "type": "object",
                  "properties": {
                    "n": {
                      "description": "QVI Issuer credential SAID",
                      "type": "string"
                    },
                    "s": {
                      "description": "SAID of required schema of the credential pointed to by this node",
                      "type": "string",
                      "const": "ENPXp1vQzRF6JwIuS-mp2U8Uf1MoADoP_GqQ62VsDZWY"
                    }
                  },
                  "additionalProperties": false,
                  "required": [
                    "n",
                    "s"
                  ]
                }
              },
              "additionalProperties": false,
              "required": [
                "d",
                "le"
              ]
            }
          ]
        },
        "r": {
          "oneOf": [
            {
              "description": "Rules block SAID",
              "type": "string"
            },
            {
              "$id": "ECllqarpkZrSIWCb97XlMpEZZH3q4kc--FQ9mbkFMb_5",
              "description": "Rules block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Rules block SAID",
                  "type": "string"
                },
                "usageDisclaimer": {
                  "description": "Usage Disclaimer",
                  "type": "object",
                  "properties": {
                    "l": {
                      "description": "Associated legal language",
                      "type": "string",
                      "const": "Usage of a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, does not assert that the Legal Entity is trustworthy, honest, reputable in its business dealings, safe to do business with, or compliant with any laws or that an implied or expressly intended purpose will be fulfilled."
                    }
                  }
                },
                "issuanceDisclaimer": {
                  "description": "Issuance Disclaimer",
                  "type": "object",
                  "properties": {
                    "l": {
                      "description": "Associated legal language",
                      "type": "string",
                      "const": "All information in a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, is accurate as of the date the validation process was complete. The vLEI Credential has been issued to the legal entity or person named in the vLEI Credential as the subject; and the qualified vLEI Issuer exercised reasonable care to perform the validation process set forth in the vLEI Ecosystem Governance Framework."
                    }
                  }
                }
              },
              "additionalProperties": false,
              "required": [
                "d",
                "usageDisclaimer",
                "issuanceDisclaimer"
              ]
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "i",
        "ri",
        "s",
        "d",
        "e",
        "r"
      ]
    }
  },
  {
    "said": "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
    "title": "Foundation Employee",
    "credentialType": "FoundationEmployeeCredential",
    "fields": [
      "email",
      "firstName",
      "lastName"
    ],
    "schema": {
      "$id": "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO",
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "Foundation Employee",
      "description": "This is a credential issued for a Foundation Employee.",
      "type": "object",
      "credentialType": "FoundationEmployeeCredential",
      "version": "1.0.0",
      "properties": {
        "v": {
          "description": "Version",
          "type": "string"
        },
        "d": {
          "description": "Credential SAID",
          "type": "string"
        },
        "u": {
          "description": "One time use nonce",
          "type": "string"
        },
        "i": {
          "description": "Issuee AID",
          "type": "string"
        },
        "ri": {
          "description": "Credential status registry",
          "type": "string"
        },
        "s": {
          "description": "Schema SAID",
          "type": "string"
        },
        "a": {
          "oneOf": [
            {
              "description": "Attributes block SAID",
              "type": "string"
            },
            {
              "$id": "EBYi_g86fmAt8n7W0I4D2sRVI7fIo1NIwtH_fITN7DaW",
              "description": "Attributes block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Attributes block SAID",
                  "type": "string"
                },
                "i": {
                  "description": "Issuee AID",
                  "type": "string"
                },
                "dt": {
                  "description": "Issuance date time",
                  "type": "string",
                  "format": "date-time"
                },
                "email": {
                  "description": "Internal email of the employee",
                  "type": "string"
                },
                "firstName": {
                  "description": "First name of the employee",
                  "type": "string"
                },
                "lastName": {
                  "description": "Last name of the employee",
                  "type": "string"
                }
              },
              "additionalProperties": false,
              "required": [
                "i",
                "dt",
                "email",
                "firstName",
                "lastName"
              ]
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "i",
        "ri",
        "s",
        "d",
        "a"
      ]
    }
  },
  {
    "said": "ENPXp1vQzRF6JwIuS-mp2U8Uf1MoADoP_GqQ62VsDZWY",
    "title": "Legal Entity vLEI Credential",
    "credentialType": "LegalEntityvLEICredential",
    "fields": [
      "LEI"
    ],
    "schema": {
      "$id": "ENPXp1vQzRF6JwIuS-mp2U8Uf1MoADoP_GqQ62VsDZWY",
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "Legal Entity vLEI Credential",
      "description": "A vLEI Credential issued by a Qualified vLEI issuer to a Legal Entity",
      "type": "object",
      "credentialType": "LegalEntityvLEICredential",
      "version": "1.0.0",
      "properties": {
        "v": {
          "description": "Version",
          "type": "string"
        },
        "d": {
          "description": "Credential SAID",
          "type": "string"
        },
        "u": {
          "description": "One time use nonce",
          "type": "string"
        },
        "i": {
          "description": "QVI Issuer AID",
          "type": "string"
        },
        "ri": {
          "description": "Credential status registry",
          "type": "string"
        },
        "s": {
          "description": "Schema SAID",
          "type": "string"
        },
        "a": {
          "oneOf": [
            {
              "description": "Attributes block SAID",
              "type": "string"
            },
            {
              "$id": "EJ6bFDLrv50bHmIDg-MSummpvYWsPa9CFygPUZyHoESj",
              "description": "Attributes block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Attributes block SAID",
                  "type": "string"
                },
                "i": {
                  "description": "LE Issuer AID",
                  "type": "string"
                },
                "dt": {
                  "description": "issuance date time",
                  "type": "string",
                  "format": "date-time"
                },
                "LEI": {
                  "description": "LE Issuer AID",
                  "type": "string",
                  "format": "ISO 17442"
                }
              },
              "additionalProperties": false,
              "required": [
                "i",
                "dt",
                "LEI"
              ]
            }
          ]
        },
        "e": {
          "oneOf": [
            {
              "description": "Edges block SAID",
              "type": "string"
            },
            {
              "$id": "EDh9sp5cPk0-yo5sFMo6WJS1HMBYIOYCwJrnPvNaH1vI",
              "description": "Edges block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Edges block SAID",
                  "type": "string"
                },
                "qvi": {
                  "description": "QVI node",
                  "type": "object",
                  "properties": {
                    "n": {
                      "description": "Issuer credential SAID",
                      "type": "string"
                    },
                    "s": {
                      "description": "SAID of required schema of the credential pointed to by this node",
                      "type": "string",
                      "const": "EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao"
                    }
                  },
                  "additionalProperties": false,
                  "required": [
                    "n",
                    "s"
                  ]
                }
              },
              "additionalProperties": false,
              "required": [
                "d",
                "qvi"
              ]
            }
          ]
        },
        "r": {
          "oneOf": [
            {
              "description": "Rules block SAID",
              "type": "string"
            },
            {
              "$id": "ECllqarpkZrSIWCb97XlMpEZZH3q4kc--FQ9mbkFMb_5",
              "description": "Rules block",
              "type": "object",
              "properties": {
                "d": {
                  "description": "Rules block SAID",
                  "type": "string"
                },
                "usageDisclaimer": {
                  "description": "Usage Disclaimer",
                  "type": "object",
                  "properties": {
                    "l": {
                      "description": "Associated legal language",
                      "type": "string",
                      "const": "Usage of a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, does not assert that the Legal Entity is trustworthy, honest, reputable in its business dealings, safe to do business with, or compliant with any laws or that an implied or expressly intended purpose will be fulfilled."
                    }
                  }
                },
                "issuanceDisclaimer": {
                  "description": "Issuance Disclaimer",
                  "type": "object",
                  "properties": {
                    "l": {
                      "description": "Associated legal language",
                      "type": "string",
                      "const": "All information in a valid, unexpired, and non-revoked vLEI Credential, as defined in the associated Ecosystem Governance Framework, is accurate as of the date the validation process was complete. The vLEI Credential has been issued to the legal entity or person named in the vLEI Credential as the subject; and the qualified vLEI Issuer exercised reasonable care to perform the validation process set forth in the vLEI Ecosystem Governance Framework."
                    }
                  }
                }
              },
              "additionalProperties": false,
              "required": [
                "d",
                "usageDisclaimer",
                "issuanceDisclaimer"
              ]
            }
          ]
        }
      },
      "additionalProperties": false,
      "required": [
        "i",
        "ri",
        "s",
        "d",
        "e",
        "r"
      ]
    }
  }
];
