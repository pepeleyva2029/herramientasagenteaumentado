export const quoteJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["advisor", "prospect", "quote", "projection", "benefits", "payments", "milestones", "extraction"],
  properties: {
    advisor: {
      type: "object",
      additionalProperties: false,
      required: ["name", "subtitle", "whatsapp", "cta"],
      properties: {
        name: { type: "string" },
        subtitle: { type: "string" },
        whatsapp: { type: "string" },
        cta: { type: "string" }
      }
    },
    prospect: {
      type: "object",
      additionalProperties: false,
      required: ["name", "age", "sex", "smoker"],
      properties: {
        name: { type: ["string", "null"] },
        age: { type: ["number", "null"] },
        sex: { type: ["string", "null"] },
        smoker: { type: ["string", "null"] }
      }
    },
    quote: {
      type: "object",
      additionalProperties: false,
      required: ["insurer", "product", "planType", "quoteNumber", "quoteDate", "currency", "termYears", "paymentTermYears"],
      properties: {
        insurer: { type: ["string", "null"] },
        product: { type: ["string", "null"] },
        planType: { type: ["string", "null"] },
        quoteNumber: { type: ["string", "null"] },
        quoteDate: { type: ["string", "null"] },
        currency: { type: ["string", "null"] },
        termYears: { type: ["number", "null"] },
        paymentTermYears: { type: ["number", "null"] }
      }
    },
    projection: {
      type: "object",
      additionalProperties: false,
      required: ["baseUnitValue", "annualGrowthRate", "manualUnitLabel", "manualUnitRate"],
      properties: {
        baseUnitValue: { type: ["number", "null"] },
        annualGrowthRate: { type: "number" },
        manualUnitLabel: { type: ["string", "null"] },
        manualUnitRate: { type: ["number", "null"] }
      }
    },
    benefits: {
      type: "object",
      additionalProperties: false,
      required: ["sumAssured", "disabilityWaiver", "disabilityPayment", "accidentalDeathAdditional", "otherCoverages"],
      properties: {
        sumAssured: { type: ["number", "null"] },
        disabilityWaiver: {
          type: "object",
          additionalProperties: false,
          required: ["included", "title", "explanation"],
          properties: {
            included: { type: "boolean" },
            title: { type: "string" },
            explanation: { type: "string" }
          }
        },
        disabilityPayment: {
          type: "object",
          additionalProperties: false,
          required: ["included", "amount", "title", "explanation"],
          properties: {
            included: { type: "boolean" },
            amount: { type: ["number", "null"] },
            title: { type: "string" },
            explanation: { type: "string" }
          }
        },
        accidentalDeathAdditional: {
          type: "object",
          additionalProperties: false,
          required: ["included", "amount", "title", "explanation"],
          properties: {
            included: { type: "boolean" },
            amount: { type: ["number", "null"] },
            title: { type: "string" },
            explanation: { type: "string" }
          }
        },
        otherCoverages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "amount", "description"],
            properties: {
              name: { type: "string" },
              amount: { type: ["number", "null"] },
              description: { type: "string" }
            }
          }
        }
      }
    },
    payments: {
      type: "object",
      additionalProperties: false,
      required: ["firstYearAnnual", "firstReceipt", "regularReceipt", "regularReceiptCount", "fractionalLoadFactor", "annualPremiums"],
      properties: {
        firstYearAnnual: { type: ["number", "null"] },
        firstReceipt: { type: ["number", "null"] },
        regularReceipt: { type: ["number", "null"] },
        regularReceiptCount: { type: ["number", "null"] },
        fractionalLoadFactor: { type: "number" },
        annualPremiums: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["year", "age", "premium"],
            properties: {
              year: { type: "number" },
              age: { type: ["number", "null"] },
              premium: { type: ["number", "null"] }
            }
          }
        }
      }
    },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["year", "age", "sumAssured", "annualPremium", "rescue", "paidUp"],
        properties: {
          year: { type: "number" },
          age: { type: ["number", "null"] },
          sumAssured: { type: ["number", "null"] },
          annualPremium: { type: ["number", "null"] },
          rescue: { type: ["number", "null"] },
          paidUp: { type: ["number", "null"] }
        }
      }
    },
    extraction: {
      type: "object",
      additionalProperties: false,
      required: ["confidence", "warnings", "sourcePages"],
      properties: {
        confidence: { type: "number" },
        warnings: { type: "array", items: { type: "string" } },
        sourcePages: { type: "array", items: { type: "number" } }
      }
    }
  }
};

export function applyBusinessDefaults(raw = {}) {
  return {
    advisor: {
      name: raw.advisor?.name || "Pepe Leyva",
      subtitle: raw.advisor?.subtitle || "Especialista en Planes de Vida",
      whatsapp: raw.advisor?.whatsapp || "5588048778",
      cta: raw.advisor?.cta || "Mándame WHA"
    },
    prospect: {
      name: raw.prospect?.name || "",
      age: numberOrNull(raw.prospect?.age),
      sex: raw.prospect?.sex || "",
      smoker: raw.prospect?.smoker || ""
    },
    quote: {
      insurer: raw.quote?.insurer || "",
      product: raw.quote?.product || "",
      planType: raw.quote?.planType || "",
      quoteNumber: raw.quote?.quoteNumber || "",
      quoteDate: raw.quote?.quoteDate || new Date().toISOString().slice(0, 10),
      currency: normalizeCurrency(raw.quote?.currency),
      termYears: numberOrNull(raw.quote?.termYears),
      paymentTermYears: numberOrNull(raw.quote?.paymentTermYears)
    },
    projection: {
      baseUnitValue: numberOrNull(raw.projection?.baseUnitValue),
      annualGrowthRate: Number.isFinite(Number(raw.projection?.annualGrowthRate)) ? Number(raw.projection.annualGrowthRate) : 0.045,
      manualUnitLabel: raw.projection?.manualUnitLabel || null,
      manualUnitRate: numberOrNull(raw.projection?.manualUnitRate)
    },
    benefits: {
      sumAssured: numberOrNull(raw.benefits?.sumAssured),
      disabilityWaiver: {
        included: Boolean(raw.benefits?.disabilityWaiver?.included),
        title: raw.benefits?.disabilityWaiver?.title || "Exención de primas por invalidez",
        explanation: raw.benefits?.disabilityWaiver?.explanation || "Si la aseguradora reconoce una invalidez total y permanente cubierta, deja de cobrar las primas indicadas en la póliza, sujeto a sus requisitos y exclusiones."
      },
      disabilityPayment: {
        included: Boolean(raw.benefits?.disabilityPayment?.included),
        amount: numberOrNull(raw.benefits?.disabilityPayment?.amount),
        title: raw.benefits?.disabilityPayment?.title || "Pago por invalidez",
        explanation: raw.benefits?.disabilityPayment?.explanation || "Si se reconoce una invalidez total y permanente cubierta, se paga la suma asegurada contratada para este beneficio."
      },
      accidentalDeathAdditional: {
        included: Boolean(raw.benefits?.accidentalDeathAdditional?.included),
        amount: numberOrNull(raw.benefits?.accidentalDeathAdditional?.amount),
        title: raw.benefits?.accidentalDeathAdditional?.title || "Beneficio adicional por muerte accidental",
        explanation: raw.benefits?.accidentalDeathAdditional?.explanation || "Si el fallecimiento accidental cumple las condiciones de la póliza, se paga una cantidad adicional a la cobertura básica."
      },
      otherCoverages: Array.isArray(raw.benefits?.otherCoverages) ? raw.benefits.otherCoverages.map((item) => ({
        name: item?.name || "Cobertura adicional",
        amount: numberOrNull(item?.amount),
        description: item?.description || ""
      })) : []
    },
    payments: {
      firstYearAnnual: numberOrNull(raw.payments?.firstYearAnnual),
      firstReceipt: numberOrNull(raw.payments?.firstReceipt),
      regularReceipt: numberOrNull(raw.payments?.regularReceipt),
      regularReceiptCount: numberOrNull(raw.payments?.regularReceiptCount),
      fractionalLoadFactor: Number.isFinite(Number(raw.payments?.fractionalLoadFactor)) ? Number(raw.payments.fractionalLoadFactor) : 1,
      annualPremiums: Array.isArray(raw.payments?.annualPremiums) ? raw.payments.annualPremiums.map((item) => ({
        year: Number(item?.year || 0),
        age: numberOrNull(item?.age),
        premium: numberOrNull(item?.premium)
      })).filter((item) => item.year > 0) : []
    },
    milestones: Array.isArray(raw.milestones) ? raw.milestones.map((item) => ({
      year: Number(item?.year || 0),
      age: numberOrNull(item?.age),
      sumAssured: numberOrNull(item?.sumAssured),
      annualPremium: numberOrNull(item?.annualPremium),
      rescue: numberOrNull(item?.rescue),
      paidUp: numberOrNull(item?.paidUp)
    })).filter((item) => item.year > 0) : [],
    extraction: {
      confidence: Math.max(0, Math.min(1, Number(raw.extraction?.confidence || 0))),
      warnings: Array.isArray(raw.extraction?.warnings) ? raw.extraction.warnings.map(String) : [],
      sourcePages: Array.isArray(raw.extraction?.sourcePages) ? raw.extraction.sourcePages.map(Number).filter(Number.isFinite) : []
    }
  };
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeCurrency(value) {
  const text = String(value || "UDI").trim().toUpperCase();
  if (text.includes("UDI")) return "UDI";
  if (text.includes("PESO") || text === "MXN" || text === "M.N.") return "MXN";
  if (text.includes("DOLAR") || text.includes("DÓLAR") || text === "USD") return "USD";
  return text || "UDI";
}
