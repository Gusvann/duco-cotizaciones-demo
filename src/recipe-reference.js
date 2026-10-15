/* Local D91 reference selected by the user. Documentary quantities and saved amounts
 * are references for one article, without production or current financial validation.
 * No workbook paths, identifiers, cells, source hashes, suppliers or customer metadata. */
(function () {
  'use strict';
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const recipes = [
  {
    "id": "SYN-NUBE-C",
    "description": "Fabricada en madera maciza de Tzalam. Acabado sayer antiflama. Contempla niveladores de plástico negro",
    "finishDescription": "Acabado sayer antiflama",
    "finishedSpecs": {
      "Largo": "60",
      "Ancho": "60",
      "Alto": "50",
      "unit": "cm"
    },
    "woodWastePercent": "30",
    "wood": [
      {
        "name": "CUBIERTA",
        "quantityPerProduct": "1",
        "width": "60",
        "length": "60",
        "lengthUnit": "cm",
        "woodKind": "Tzalam",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": "1"
      },
      {
        "name": "PATAS",
        "quantityPerProduct": "4",
        "width": "50",
        "length": "6",
        "lengthUnit": "cm",
        "woodKind": "Tzalam",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": ""
      },
      {
        "name": "TRAVESAÑOS",
        "quantityPerProduct": "2",
        "width": "60",
        "length": "4",
        "lengthUnit": "cm",
        "woodKind": "Tzalam",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": ""
      }
    ],
    "hardware": [
      {
        "name": "NIVELADORES ASTRIADO",
        "specification": "NIVELADORES ASTRIADO",
        "quantityPerProduct": "4",
        "unit": "PZA",
        "unitPrice": "5"
      },
      {
        "name": "TUERCA INSERTO",
        "specification": "TUERCA INSERTO",
        "quantityPerProduct": "4",
        "unit": "PZA",
        "unitPrice": "0.5"
      }
    ],
    "observations": [
      {
        "name": "Acabado Sayer retardante fuego",
        "quantity": "0.3017142857",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Fondo Sayer retardante fuego",
        "quantity": "0.1508571429",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Dominos para ensamble",
        "quantity": "9.6",
        "unit": "pza de consumo calculado",
        "status": "Consumo fraccionario documental, no conteo entero validado de montaje"
      },
      {
        "name": "Pegamento para entablerado",
        "quantity": "0.216",
        "unit": "L",
        "status": "Consumo documental por unidad, no compra ni cargo adicional"
      },
      {
        "name": "Carpintería por jornada",
        "quantity": "0.4",
        "unit": "día",
        "status": "Asignación documental por costeo, no tarifa ni tiempo de taller confirmado"
      },
      {
        "name": "Ensambles",
        "quantity": "0.96",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      },
      {
        "name": "CNC/láser de madera",
        "quantity": "0.2033333333",
        "unit": "h asignada por costeo",
        "status": "Referencia documental; no activa tarifa ni asigna CNC a una pieza"
      },
      {
        "name": "Longitud global CNC/láser de madera",
        "quantity": "2.44",
        "unit": "ml",
        "status": "Agregado documental por unidad, sin atribución a piezas; decisión y aplicación CNC pendientes"
      },
      {
        "name": "Barniz",
        "quantity": "1.584",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      }
    ],
    "economics": {
      "hardware": [
        {
          "name": "NIVELADORES ASTRIADO",
          "kind": "HARDWARE",
          "quantity": "4",
          "quantityUnit": "PZA",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA",
          "totalSaved": "20"
        },
        {
          "name": "TUERCA INSERTO",
          "kind": "HARDWARE",
          "quantity": "4",
          "quantityUnit": "PZA",
          "unitPrice": "0.5",
          "priceUnit": "SOURCE_MONEY_PER_PZA",
          "totalSaved": "2"
        }
      ],
      "wood": [
        {
          "name": "CUBIERTA",
          "kind": "WOOD",
          "quantity": "9.232382101",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "80",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "738.5905681"
        },
        {
          "name": "PATAS",
          "kind": "WOOD",
          "quantity": "3.0774607",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "80",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "246.196856"
        },
        {
          "name": "TRAVESAÑOS",
          "kind": "WOOD",
          "quantity": "1.23098428",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "80",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "98.47874241"
        }
      ],
      "consumables": [
        {
          "name": "ACABADO SAYER RETARDANTE FUEGO",
          "kind": "FINISH",
          "quantity": "0.3017142857",
          "quantityUnit": "L",
          "unitPrice": "403",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "121.5908571"
        },
        {
          "name": "FONDO SAYER  SAYER RETARDANTE FUEGO",
          "kind": "FINISH_PRIMER",
          "quantity": "0.1508571429",
          "quantityUnit": "L",
          "unitPrice": "226",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "34.09371429"
        },
        {
          "name": "DOMINOS",
          "kind": "DOMINO_CONSUMPTION",
          "quantity": "9.6",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "48"
        },
        {
          "name": "PEGAMENTO ENTABLERADO",
          "kind": "GLUE",
          "quantity": "0.216",
          "quantityUnit": "L",
          "unitPrice": "183",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "39.528"
        }
      ],
      "processes": [
        {
          "name": "MO ARMADO",
          "kind": "ASSEMBLY",
          "quantity": "0.528",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENTABLERADO",
          "kind": "JOINTING",
          "quantity": "0.36",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENSAMBLES",
          "kind": "JOINERY",
          "quantity": "9.6",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "0"
        },
        {
          "name": "MO BARNIZ",
          "kind": "VARNISH_LABOR",
          "quantity": "1.056",
          "quantityUnit": "M2_FINISH",
          "unitPrice": "180",
          "priceUnit": "SOURCE_MONEY_PER_M2_FINISH",
          "totalSaved": "190.08"
        },
        {
          "name": "CNC / LASER",
          "kind": "CNC",
          "quantity": "2.44",
          "quantityUnit": "ML",
          "unitPrice": "10",
          "priceUnit": "SOURCE_MONEY_PER_MINUTE",
          "totalSaved": "122"
        }
      ],
      "dayLabor": [
        {
          "name": "MO Carpintería",
          "kind": "LABOR_DAYS",
          "quantity": "0.4",
          "quantityUnit": "DAY",
          "unitPrice": "867.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "347"
        },
        {
          "name": "MO Instalación",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "1200",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO CNC /Láser",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "507.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Acabados",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "697.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Tejido",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "840",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Integración",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "502.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        }
      ],
      "parameters": {
        "cncMinutesPerMeter": {
          "value": "5",
          "unit": "min/m"
        }
      }
    }
  },
  {
    "id": "SYN-NUBE-O",
    "description": "Fabricada en madera maciza de Encino rojo. Acabado sayer retardante de flama. Contempla niveladores de plástico negro",
    "finishDescription": "Acabado sayer retardante de flama",
    "finishedSpecs": {
      "Largo": "60",
      "Ancho": "60",
      "Alto": "50",
      "unit": "cm"
    },
    "woodWastePercent": "30",
    "wood": [
      {
        "name": "CUBIERTA",
        "quantityPerProduct": "1",
        "width": "60",
        "length": "60",
        "lengthUnit": "cm",
        "woodKind": "Encino rojo",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": "1"
      },
      {
        "name": "PATAS",
        "quantityPerProduct": "4",
        "width": "50",
        "length": "6",
        "lengthUnit": "cm",
        "woodKind": "Encino rojo",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": ""
      },
      {
        "name": "TRAVESAÑOS",
        "quantityPerProduct": "2",
        "width": "60",
        "length": "4",
        "lengthUnit": "cm",
        "woodKind": "Encino rojo",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": ""
      }
    ],
    "hardware": [
      {
        "name": "NIVELADORES ASTRIADO",
        "specification": "NIVELADORES ASTRIADO",
        "quantityPerProduct": "4",
        "unit": "PZA",
        "unitPrice": "5"
      },
      {
        "name": "TUERCA INSERTO",
        "specification": "TUERCA INSERTO",
        "quantityPerProduct": "4",
        "unit": "PZA",
        "unitPrice": "0.5"
      }
    ],
    "observations": [
      {
        "name": "Acabado Sayer retardante fuego",
        "quantity": "0.3017142857",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Fondo Sayer retardante fuego",
        "quantity": "0.1508571429",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Dominos para ensamble",
        "quantity": "9.6",
        "unit": "pza de consumo calculado",
        "status": "Consumo fraccionario documental, no conteo entero validado de montaje"
      },
      {
        "name": "Pegamento para entablerado",
        "quantity": "0.216",
        "unit": "L",
        "status": "Consumo documental por unidad, no compra ni cargo adicional"
      },
      {
        "name": "Carpintería por jornada",
        "quantity": "0.4",
        "unit": "día",
        "status": "Asignación documental por costeo, no tarifa ni tiempo de taller confirmado"
      },
      {
        "name": "Armado",
        "quantity": "2.64",
        "unit": "h asignada por costeo",
        "status": "Referencia documental de esta hoja, no tiempo de taller ni costo confirmado"
      },
      {
        "name": "Entablerado",
        "quantity": "1.08",
        "unit": "h asignada por costeo",
        "status": "Referencia documental de esta hoja, no tiempo de taller ni costo confirmado"
      },
      {
        "name": "Ensambles",
        "quantity": "0.96",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      },
      {
        "name": "CNC/láser de madera",
        "quantity": "0.2033333333",
        "unit": "h asignada por costeo",
        "status": "Referencia documental; no activa tarifa ni asigna CNC a una pieza"
      },
      {
        "name": "Longitud global CNC/láser de madera",
        "quantity": "2.44",
        "unit": "ml",
        "status": "Agregado documental por unidad, sin atribución a piezas; decisión y aplicación CNC pendientes"
      },
      {
        "name": "Barniz",
        "quantity": "1.584",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      }
    ],
    "economics": {
      "hardware": [
        {
          "name": "NIVELADORES ASTRIADO",
          "kind": "HARDWARE",
          "quantity": "4",
          "quantityUnit": "PZA",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA",
          "totalSaved": "20"
        },
        {
          "name": "TUERCA INSERTO",
          "kind": "HARDWARE",
          "quantity": "4",
          "quantityUnit": "PZA",
          "unitPrice": "0.5",
          "priceUnit": "SOURCE_MONEY_PER_PZA",
          "totalSaved": "2"
        }
      ],
      "wood": [
        {
          "name": "CUBIERTA",
          "kind": "WOOD",
          "quantity": "9.232382101",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "77",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "710.8934218"
        },
        {
          "name": "PATAS",
          "kind": "WOOD",
          "quantity": "3.0774607",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "77",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "236.9644739"
        },
        {
          "name": "TRAVESAÑOS",
          "kind": "WOOD",
          "quantity": "1.23098428",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "77",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "94.78578957"
        }
      ],
      "consumables": [
        {
          "name": "ACABADO SAYER RETARDANTE FUEGO",
          "kind": "FINISH",
          "quantity": "0.3017142857",
          "quantityUnit": "L",
          "unitPrice": "403",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "121.5908571"
        },
        {
          "name": "FONDO SAYER  SAYER RETARDANTE FUEGO",
          "kind": "FINISH_PRIMER",
          "quantity": "0.1508571429",
          "quantityUnit": "L",
          "unitPrice": "226",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "34.09371429"
        },
        {
          "name": "DOMINOS",
          "kind": "DOMINO_CONSUMPTION",
          "quantity": "9.6",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "48"
        },
        {
          "name": "PEGAMENTO ENTABLERADO",
          "kind": "GLUE",
          "quantity": "0.216",
          "quantityUnit": "L",
          "unitPrice": "183",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "39.528"
        }
      ],
      "processes": [
        {
          "name": "MO ARMADO",
          "kind": "ASSEMBLY",
          "quantity": "0.528",
          "quantityUnit": "M2",
          "unitPrice": "500",
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "264"
        },
        {
          "name": "MO ENTABLERADO",
          "kind": "JOINTING",
          "quantity": "0.36",
          "quantityUnit": "M2",
          "unitPrice": "300",
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "108"
        },
        {
          "name": "MO ENSAMBLES",
          "kind": "JOINERY",
          "quantity": "9.6",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": "10",
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "96"
        },
        {
          "name": "MO BARNIZ",
          "kind": "VARNISH_LABOR",
          "quantity": "1.056",
          "quantityUnit": "M2_FINISH",
          "unitPrice": "180",
          "priceUnit": "SOURCE_MONEY_PER_M2_FINISH",
          "totalSaved": "190.08"
        },
        {
          "name": "CNC / LASER",
          "kind": "CNC",
          "quantity": "2.44",
          "quantityUnit": "ML",
          "unitPrice": "10",
          "priceUnit": "SOURCE_MONEY_PER_MINUTE",
          "totalSaved": "122"
        }
      ],
      "dayLabor": [
        {
          "name": "MO Carpintería",
          "kind": "LABOR_DAYS",
          "quantity": "0.4",
          "quantityUnit": "DAY",
          "unitPrice": "867.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "347"
        },
        {
          "name": "MO Instalación",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "1200",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO CNC /Láser",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "507.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Acabados",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "697.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Tejido",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "840",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Integración",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "502.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        }
      ],
      "parameters": {
        "cncMinutesPerMeter": {
          "value": "5",
          "unit": "min/m"
        }
      }
    }
  },
  {
    "id": "SYN-PRISMA-C",
    "description": "Fabricada en madera maciza de Tzalam con acabado sayer retardante de flama.",
    "finishDescription": "Acabado sayer retardante de flama",
    "finishedSpecs": {
      "Largo": "76",
      "Ancho": "76",
      "Alto": "3.2",
      "unit": "cm"
    },
    "woodWastePercent": "30",
    "wood": [
      {
        "name": "CUBIERTA",
        "quantityPerProduct": "1",
        "width": "81",
        "length": "81",
        "lengthUnit": "cm",
        "woodKind": "Tzalam",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": "1"
      }
    ],
    "hardware": [],
    "observations": [
      {
        "name": "Acabado Sayer retardante fuego",
        "quantity": "0.3749142857",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Fondo Sayer retardante fuego",
        "quantity": "0.1874571429",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Dominos para ensamble",
        "quantity": "9.76",
        "unit": "pza de consumo calculado",
        "status": "Consumo fraccionario documental, no conteo entero validado de montaje"
      },
      {
        "name": "Pegamento para entablerado",
        "quantity": "0.39366",
        "unit": "L",
        "status": "Consumo documental por unidad, no compra ni cargo adicional"
      },
      {
        "name": "Carpintería por jornada",
        "quantity": "0.4",
        "unit": "día",
        "status": "Asignación documental por costeo, no tarifa ni tiempo de taller confirmado"
      },
      {
        "name": "Ensambles",
        "quantity": "0.976",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      },
      {
        "name": "CNC/láser de madera",
        "quantity": "0.1983333333",
        "unit": "h asignada por costeo",
        "status": "Referencia documental; no activa tarifa ni asigna CNC a una pieza"
      },
      {
        "name": "Longitud global CNC/láser de madera",
        "quantity": "2.38",
        "unit": "ml",
        "status": "Agregado documental por unidad, sin atribución automática; decisión y aplicación CNC pendientes"
      },
      {
        "name": "Barniz",
        "quantity": "1.9683",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      }
    ],
    "economics": {
      "hardware": [],
      "wood": [
        {
          "name": "CUBIERTA",
          "kind": "WOOD",
          "quantity": "16.82601638",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "80",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "1346.08131"
        }
      ],
      "consumables": [
        {
          "name": "ACABADO SAYER RETARDANTE FUEGO",
          "kind": "FINISH",
          "quantity": "0.3749142857",
          "quantityUnit": "L",
          "unitPrice": "403",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "151.0904571"
        },
        {
          "name": "FONDO SAYER  SAYER RETARDANTE FUEGO",
          "kind": "FINISH_PRIMER",
          "quantity": "0.1874571429",
          "quantityUnit": "L",
          "unitPrice": "226",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "42.36531429"
        },
        {
          "name": "DOMINOS",
          "kind": "DOMINO_CONSUMPTION",
          "quantity": "9.76",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "48.8"
        },
        {
          "name": "PEGAMENTO ENTABLERADO",
          "kind": "GLUE",
          "quantity": "0.39366",
          "quantityUnit": "L",
          "unitPrice": "183",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "72.03978"
        }
      ],
      "processes": [
        {
          "name": "MO ARMADO",
          "kind": "ASSEMBLY",
          "quantity": "0.6561",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENTABLERADO",
          "kind": "JOINTING",
          "quantity": "0.6561",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENSAMBLES",
          "kind": "JOINERY",
          "quantity": "9.76",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "0"
        },
        {
          "name": "MO BARNIZ",
          "kind": "VARNISH_LABOR",
          "quantity": "1.3122",
          "quantityUnit": "M2_FINISH",
          "unitPrice": "180",
          "priceUnit": "SOURCE_MONEY_PER_M2_FINISH",
          "totalSaved": "236.196"
        },
        {
          "name": "CNC / LASER",
          "kind": "CNC",
          "quantity": "2.38",
          "quantityUnit": "ML",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_MINUTE",
          "totalSaved": "59.5"
        }
      ],
      "dayLabor": [
        {
          "name": "MO Carpintería",
          "kind": "LABOR_DAYS",
          "quantity": "0.4",
          "quantityUnit": "DAY",
          "unitPrice": "867.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "347"
        },
        {
          "name": "MO Instalación",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "1200",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO CNC /Láser",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "507.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Acabados",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "697.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Tejido",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "840",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Integración",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "502.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        }
      ],
      "parameters": {
        "cncMinutesPerMeter": {
          "value": "5",
          "unit": "min/m"
        }
      }
    }
  },
  {
    "id": "SYN-PRISMA-O",
    "description": "Fabricada en madera maciza de Encino blanco con acabado sayer retardante de flama.",
    "finishDescription": "Acabado sayer retardante de flama",
    "finishedSpecs": {
      "Largo": "76",
      "Ancho": "76",
      "Alto": "3.2",
      "unit": "cm"
    },
    "woodWastePercent": "30",
    "wood": [
      {
        "name": "CUBIERTA",
        "quantityPerProduct": "1",
        "width": "81",
        "length": "81",
        "lengthUnit": "cm",
        "woodKind": "Encino blanco",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": "1"
      }
    ],
    "hardware": [],
    "observations": [
      {
        "name": "Acabado Sayer retardante fuego",
        "quantity": "0.3749142857",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Fondo Sayer retardante fuego",
        "quantity": "0.1874571429",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Dominos para ensamble",
        "quantity": "9.76",
        "unit": "pza de consumo calculado",
        "status": "Consumo fraccionario documental, no conteo entero validado de montaje"
      },
      {
        "name": "Pegamento para entablerado",
        "quantity": "0.39366",
        "unit": "L",
        "status": "Consumo documental por unidad, no compra ni cargo adicional"
      },
      {
        "name": "Carpintería por jornada",
        "quantity": "0.4",
        "unit": "día",
        "status": "Asignación documental por costeo, no tarifa ni tiempo de taller confirmado"
      },
      {
        "name": "Ensambles",
        "quantity": "0.976",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      },
      {
        "name": "CNC/láser de madera",
        "quantity": "0.1983333333",
        "unit": "h asignada por costeo",
        "status": "Referencia documental; no activa tarifa ni asigna CNC a una pieza"
      },
      {
        "name": "Longitud global CNC/láser de madera",
        "quantity": "2.38",
        "unit": "ml",
        "status": "Agregado documental por unidad, sin atribución automática; decisión y aplicación CNC pendientes"
      },
      {
        "name": "Barniz",
        "quantity": "1.9683",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      }
    ],
    "economics": {
      "hardware": [],
      "wood": [
        {
          "name": "CUBIERTA",
          "kind": "WOOD",
          "quantity": "16.82601638",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "165.76",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "2789.080475"
        }
      ],
      "consumables": [
        {
          "name": "ACABADO SAYER RETARDANTE FUEGO",
          "kind": "FINISH",
          "quantity": "0.3749142857",
          "quantityUnit": "L",
          "unitPrice": "403",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "151.0904571"
        },
        {
          "name": "FONDO SAYER  SAYER RETARDANTE FUEGO",
          "kind": "FINISH_PRIMER",
          "quantity": "0.1874571429",
          "quantityUnit": "L",
          "unitPrice": "226",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "42.36531429"
        },
        {
          "name": "DOMINOS",
          "kind": "DOMINO_CONSUMPTION",
          "quantity": "9.76",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "48.8"
        },
        {
          "name": "PEGAMENTO ENTABLERADO",
          "kind": "GLUE",
          "quantity": "0.39366",
          "quantityUnit": "L",
          "unitPrice": "183",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "72.03978"
        }
      ],
      "processes": [
        {
          "name": "MO ARMADO",
          "kind": "ASSEMBLY",
          "quantity": "0.6561",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENTABLERADO",
          "kind": "JOINTING",
          "quantity": "0.6561",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENSAMBLES",
          "kind": "JOINERY",
          "quantity": "9.76",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "0"
        },
        {
          "name": "MO BARNIZ",
          "kind": "VARNISH_LABOR",
          "quantity": "1.3122",
          "quantityUnit": "M2_FINISH",
          "unitPrice": "180",
          "priceUnit": "SOURCE_MONEY_PER_M2_FINISH",
          "totalSaved": "236.196"
        },
        {
          "name": "CNC / LASER",
          "kind": "CNC",
          "quantity": "2.38",
          "quantityUnit": "ML",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_MINUTE",
          "totalSaved": "59.5"
        }
      ],
      "dayLabor": [
        {
          "name": "MO Carpintería",
          "kind": "LABOR_DAYS",
          "quantity": "0.4",
          "quantityUnit": "DAY",
          "unitPrice": "867.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "347"
        },
        {
          "name": "MO Instalación",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "1200",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO CNC /Láser",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "507.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Acabados",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "697.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Tejido",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "840",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Integración",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "502.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        }
      ],
      "parameters": {
        "cncMinutesPerMeter": {
          "value": "5",
          "unit": "min/m"
        }
      }
    }
  },
  {
    "id": "SYN-PRISMA-G",
    "description": "Fabricada en madera maciza de Encino rojo con acabado sayer retardante de flama.",
    "finishDescription": "Acabado sayer retardante de flama",
    "finishedSpecs": {
      "Largo": "76",
      "Ancho": "76",
      "Alto": "3.2",
      "unit": "cm"
    },
    "woodWastePercent": "30",
    "wood": [
      {
        "name": "CUBIERTA",
        "quantityPerProduct": "1",
        "width": "81",
        "length": "81",
        "lengthUnit": "cm",
        "woodKind": "Encino rojo",
        "thickness": "1.5",
        "finishFaces": "2",
        "jointed": "1"
      }
    ],
    "hardware": [],
    "observations": [
      {
        "name": "Acabado Sayer retardante fuego",
        "quantity": "0.3749142857",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Fondo Sayer retardante fuego",
        "quantity": "0.1874571429",
        "unit": "L",
        "status": "Consumo documental por unidad; rendimiento no activado"
      },
      {
        "name": "Dominos para ensamble",
        "quantity": "9.76",
        "unit": "pza de consumo calculado",
        "status": "Consumo fraccionario documental, no conteo entero validado de montaje"
      },
      {
        "name": "Pegamento para entablerado",
        "quantity": "0.39366",
        "unit": "L",
        "status": "Consumo documental por unidad, no compra ni cargo adicional"
      },
      {
        "name": "Carpintería por jornada",
        "quantity": "0.4",
        "unit": "día",
        "status": "Asignación documental por costeo, no tarifa ni tiempo de taller confirmado"
      },
      {
        "name": "Ensambles",
        "quantity": "0.976",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      },
      {
        "name": "CNC/láser de madera",
        "quantity": "0.1983333333",
        "unit": "h asignada por costeo",
        "status": "Referencia documental; no activa tarifa ni asigna CNC a una pieza"
      },
      {
        "name": "Longitud global CNC/láser de madera",
        "quantity": "2.38",
        "unit": "ml",
        "status": "Agregado documental por unidad, sin atribución automática; decisión y aplicación CNC pendientes"
      },
      {
        "name": "Barniz",
        "quantity": "1.9683",
        "unit": "h asignada por costeo",
        "status": "Referencia documental, no costo confirmado"
      }
    ],
    "economics": {
      "hardware": [],
      "wood": [
        {
          "name": "CUBIERTA",
          "kind": "WOOD",
          "quantity": "16.82601638",
          "quantityUnit": "P1_WOOD_UNIT_PENDING_DUCO",
          "unitPrice": "77",
          "priceUnit": "SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO",
          "totalSaved": "1295.603261"
        }
      ],
      "consumables": [
        {
          "name": "ACABADO SAYER RETARDANTE FUEGO",
          "kind": "FINISH",
          "quantity": "0.3749142857",
          "quantityUnit": "L",
          "unitPrice": "403",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "151.0904571"
        },
        {
          "name": "FONDO SAYER  SAYER RETARDANTE FUEGO",
          "kind": "FINISH_PRIMER",
          "quantity": "0.1874571429",
          "quantityUnit": "L",
          "unitPrice": "226",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "42.36531429"
        },
        {
          "name": "DOMINOS",
          "kind": "DOMINO_CONSUMPTION",
          "quantity": "9.76",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "48.8"
        },
        {
          "name": "PEGAMENTO ENTABLERADO",
          "kind": "GLUE",
          "quantity": "0.39366",
          "quantityUnit": "L",
          "unitPrice": "183",
          "priceUnit": "SOURCE_MONEY_PER_L",
          "totalSaved": "72.03978"
        }
      ],
      "processes": [
        {
          "name": "MO ARMADO",
          "kind": "ASSEMBLY",
          "quantity": "0.6561",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENTABLERADO",
          "kind": "JOINTING",
          "quantity": "0.6561",
          "quantityUnit": "M2",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_M2",
          "totalSaved": "0"
        },
        {
          "name": "MO ENSAMBLES",
          "kind": "JOINERY",
          "quantity": "9.76",
          "quantityUnit": "FRACTIONAL_PZA_CONSUMPTION",
          "unitPrice": null,
          "priceUnit": "SOURCE_MONEY_PER_PZA_CONSUMPTION",
          "totalSaved": "0"
        },
        {
          "name": "MO BARNIZ",
          "kind": "VARNISH_LABOR",
          "quantity": "1.3122",
          "quantityUnit": "M2_FINISH",
          "unitPrice": "180",
          "priceUnit": "SOURCE_MONEY_PER_M2_FINISH",
          "totalSaved": "236.196"
        },
        {
          "name": "CNC / LASER",
          "kind": "CNC",
          "quantity": "2.38",
          "quantityUnit": "ML",
          "unitPrice": "5",
          "priceUnit": "SOURCE_MONEY_PER_MINUTE",
          "totalSaved": "59.5"
        }
      ],
      "dayLabor": [
        {
          "name": "MO Carpintería",
          "kind": "LABOR_DAYS",
          "quantity": "0.4",
          "quantityUnit": "DAY",
          "unitPrice": "867.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "347"
        },
        {
          "name": "MO Instalación",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "1200",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO CNC /Láser",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "507.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Acabados",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "697.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Tejido",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "840",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        },
        {
          "name": "MO Integración",
          "kind": "LABOR_DAYS",
          "quantity": null,
          "quantityUnit": "DAY",
          "unitPrice": "502.5",
          "priceUnit": "SOURCE_MONEY_PER_DAY",
          "totalSaved": "0"
        }
      ],
      "parameters": {
        "cncMinutesPerMeter": {
          "value": "5",
          "unit": "min/m"
        }
      }
    }
  }
];
  function recipe(id) { return recipes.find(value => value.id === id) || null; }
  globalThis.DemoRecipeReference = freeze({ source: 'LOCAL_REFERENCE_D91', recipes, recipe });
}());
