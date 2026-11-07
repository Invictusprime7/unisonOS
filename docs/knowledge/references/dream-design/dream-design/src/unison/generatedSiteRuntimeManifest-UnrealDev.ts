export const GENERATED_SITE_RUNTIME_MANIFEST = {
  "version": "1.0",
  "siteId": "dab4ab84-a286-4c62-a401-ebf6397998bb",
  "snapshotId": "snap__7qR62aF",
  "enabledCapabilities": [],
  "components": [
    {
      "instanceId": "cmp_5u1ZfgOb",
      "componentSlug": "contact-form",
      "usedOnPages": [
        "f20eab4c-04f8-4912-a946-2362f9022562"
      ],
      "requiredCapabilities": [
        "contact"
      ],
      "catalogSurfaces": [],
      "writeIntent": "contact.submit",
      "slotBindings": [
        "form-submit"
      ],
      "status": "blocked",
      "blockers": [
        "Missing required capability: contact.",
        "Slot intent requires capability: contact."
      ],
      "bindings": {
        "formId": "form_VowK01H3"
      },
      "pageLess": false,
      "slots": [
        {
          "slotId": "cmp_5u1ZfgOb:form-submit",
          "slot": "form-submit",
          "intent": "contact.submit",
          "source": "component-contract",
          "section": null,
          "sectionInstanceId": null,
          "variantId": null,
          "policyIntent": null,
          "status": "blocked",
          "blockers": [
            "Slot intent requires capability: contact."
          ]
        }
      ]
    },
    {
      "instanceId": "cmp_9uFiNALn",
      "componentSlug": "chat-widget",
      "usedOnPages": [
        "f20eab4c-04f8-4912-a946-2362f9022562"
      ],
      "requiredCapabilities": [],
      "catalogSurfaces": [],
      "writeIntent": null,
      "slotBindings": [
        "icon-chat"
      ],
      "status": "blocked",
      "blockers": [
        "No runtime intent is resolved for slot: icon-chat."
      ],
      "bindings": {},
      "pageLess": false,
      "slots": [
        {
          "slotId": "cmp_9uFiNALn:icon-chat",
          "slot": "icon-chat",
          "intent": null,
          "source": "unresolved",
          "section": null,
          "sectionInstanceId": null,
          "variantId": null,
          "policyIntent": null,
          "status": "blocked",
          "blockers": [
            "No runtime intent is resolved for slot: icon-chat."
          ]
        }
      ]
    },
    {
      "instanceId": "cmp_DwSkW2YH",
      "componentSlug": "contact-form",
      "usedOnPages": [
        "f20eab4c-04f8-4912-a946-2362f9022562"
      ],
      "requiredCapabilities": [
        "contact"
      ],
      "catalogSurfaces": [],
      "writeIntent": "contact.submit",
      "slotBindings": [
        "form-submit"
      ],
      "status": "blocked",
      "blockers": [
        "Missing required capability: contact.",
        "Slot intent requires capability: contact."
      ],
      "bindings": {
        "formId": "form_ZTS6NTYR"
      },
      "pageLess": false,
      "slots": [
        {
          "slotId": "cmp_DwSkW2YH:form-submit",
          "slot": "form-submit",
          "intent": "contact.submit",
          "source": "component-contract",
          "section": null,
          "sectionInstanceId": null,
          "variantId": null,
          "policyIntent": null,
          "status": "blocked",
          "blockers": [
            "Slot intent requires capability: contact."
          ]
        }
      ]
    },
    {
      "instanceId": "cmp_d9eadV2P",
      "componentSlug": "newsletter-signup",
      "usedOnPages": [
        "f20eab4c-04f8-4912-a946-2362f9022562"
      ],
      "requiredCapabilities": [
        "newsletter"
      ],
      "catalogSurfaces": [],
      "writeIntent": "newsletter.subscribe",
      "slotBindings": [
        "newsletter"
      ],
      "status": "blocked",
      "blockers": [
        "Missing required capability: newsletter.",
        "Slot intent requires capability: newsletter."
      ],
      "bindings": {
        "formId": "form_i2hIYN5C"
      },
      "pageLess": false,
      "slots": [
        {
          "slotId": "cmp_d9eadV2P:newsletter",
          "slot": "newsletter",
          "intent": "newsletter.subscribe",
          "source": "component-contract",
          "section": null,
          "sectionInstanceId": null,
          "variantId": null,
          "policyIntent": null,
          "status": "blocked",
          "blockers": [
            "Slot intent requires capability: newsletter."
          ]
        }
      ]
    }
  ],
  "reads": [],
  "intents": [
    {
      "intent": "contact.submit",
      "handler": "intent-exec",
      "surface": "overlay",
      "requiredCapabilities": [
        "contact"
      ],
      "componentIds": [
        "cmp_5u1ZfgOb",
        "cmp_DwSkW2YH"
      ]
    },
    {
      "intent": "newsletter.subscribe",
      "handler": "intent-exec",
      "surface": "overlay",
      "requiredCapabilities": [
        "newsletter"
      ],
      "componentIds": [
        "cmp_d9eadV2P"
      ]
    }
  ],
  "controllers": [
    {
      "handler": "intent-exec",
      "transport": "supabase-function",
      "functionName": "intent-exec",
      "intents": [
        "contact.submit",
        "newsletter.subscribe"
      ],
      "requiredCapabilities": [
        "contact",
        "newsletter"
      ]
    }
  ],
  "agents": [],
  "requiredBackendFunctions": [
    "intent-exec"
  ],
  "readiness": {
    "status": "blocked",
    "blockers": [
      "Missing required capability: contact.",
      "Slot intent requires capability: contact.",
      "No runtime intent is resolved for slot: icon-chat.",
      "Missing required capability: contact.",
      "Slot intent requires capability: contact.",
      "Missing required capability: newsletter.",
      "Slot intent requires capability: newsletter."
    ]
  },
  "generatedAt": "2026-10-22T03:52:57.022Z"
} as const;
