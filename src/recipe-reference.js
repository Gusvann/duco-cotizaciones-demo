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
  // Additional selected local recipe, read-only source review on 5 Nov 2026.
  // Preserve historical source units, including the unresolved hardware HOJA.
  recipes.push({
    id:'SYN-BOLONIA-R',description:'Estructura metálica con base tubular de 3/4 de pulgada y pintura electrostática negra RAL 7021. Cubierta en madera maciza de Encino rojo con acabado Sayer retardante de flama.',
    finishDescription:'Sayer retardante de flama; estructura negra RAL 7021',
    workshopDefaults:{domino:{quantity:'1',lengthCm:'71',unions:'4'}},
    finishedSpecs:{Largo:'70.4',Ancho:'70.4',Alto:'50',unit:'cm'},woodWastePercent:'30',
    wood:[{name:'CUBIERTA',quantityPerProduct:'1',width:'76',length:'76',lengthUnit:'cm',woodKind:'Encino rojo',thickness:'1.5',finishFaces:'2',jointed:'1',cnc:{decision:'yes',length:'223',unit:'cm',repetitions:'1'}}],
    hardware:[{name:'NIVELADOR ESTRIADO',specification:'NIVELADOR ESTRIADO',quantityPerProduct:'4',unit:'PZA',unitPrice:'5'},
      {name:'TUERCA INSERTO',specification:'TUERCA INSERTO',quantityPerProduct:'4',unit:'HOJA',unitPrice:'0.5'}],
    boards:[{name:'Bajo cubierta',quantityPerProduct:'1',width:'71',length:'71',lengthUnit:'cm',substrate:'Lisapol',coating:'',thickness:'12',supplier:'PLACOVE',
      unitPrice:'868.62',sheetAreaM2:'2.88',wasteRate:'15',detail:{edgeWidthCount:'',edgeLengthCount:'',paintFaces:'',gluedFaces:'',linearCentimeters:'284',laserCount:'1'}}],
    metal:[{name:'Bajo cubierta',section:'metal-sheet',quantity:'1',width:'66',length:'66',lengthUnit:'cm',gauge:'16',unitPrice:'55',detail:{kgPerM2:'12.5',paintPrice:'170',laborPrice:'65'}},
      {name:'Patas',section:'metal-tube',quantity:'4',width:'',length:'50',lengthUnit:'cm',gauge:'',unitPrice:'50',detail:{sideACm:'1.905',sideBCm:'1.905',kgPerMl:'2.23',paintPrice:'55',laborPrice:'65'}},
      {name:'Cruceta',section:'metal-tube',quantity:'1',width:'',length:'132',lengthUnit:'cm',gauge:'',unitPrice:'50',detail:{sideACm:'1.905',sideBCm:'1.905',kgPerMl:'2.23',paintPrice:'55',laborPrice:'65'}}],
    observations:[{name:'TUERCA INSERTO',quantity:'4',unit:'HOJA',status:'Unidad original pendiente de aclaración; no se convierte a pieza.'}],
    economics:{
      hardware:[{name:'NIVELADOR ESTRIADO',kind:'HARDWARE',quantity:'4',quantityUnit:'PZA',unitPrice:'5',priceUnit:'SOURCE_MONEY_PER_PZA',totalSaved:'20'},
        {name:'TUERCA INSERTO',kind:'HARDWARE',quantity:'4',quantityUnit:'HOJA',unitPrice:'0.5',priceUnit:'SOURCE_MONEY_PER_HOJA',totalSaved:'2'}],
      wood:[{name:'CUBIERTA',kind:'WOOD',quantity:'14.81284417114289',quantityUnit:'P1_WOOD_UNIT_PENDING_DUCO',unitPrice:'80',priceUnit:'SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO',totalSaved:'1185.0275336914312'}],
      consumables:[{name:'ACABADO SAYER RETARDANTE FUEGO',kind:'FINISH',quantity:'0.33005714285714288',quantityUnit:'L',unitPrice:'403',priceUnit:'SOURCE_MONEY_PER_L',totalSaved:'133.01302857142858'},
        {name:'FONDO SAYER RETARDANTE FUEGO',kind:'FINISH_PRIMER',quantity:'0.16502857142857144',quantityUnit:'L',unitPrice:'226',priceUnit:'SOURCE_MONEY_PER_L',totalSaved:'37.296457142857143'},
        {name:'DOMINOS',kind:'DOMINO_CONSUMPTION',quantity:'11.36',quantityUnit:'FRACTIONAL_PZA_CONSUMPTION',unitPrice:'5',priceUnit:'SOURCE_MONEY_PER_PZA_CONSUMPTION',totalSaved:'56.8'},
        {name:'PEGAMENTO ENTABLERADO',kind:'GLUE',quantity:'0.34656',quantityUnit:'L',unitPrice:'183',priceUnit:'SOURCE_MONEY_PER_L',totalSaved:'63.42048'}],
      processes:[{name:'MO ARMADO',kind:'ASSEMBLY',quantity:'0.5776',quantityUnit:'M2',unitPrice:null,priceUnit:'SOURCE_MONEY_PER_M2',totalSaved:'0'},
        {name:'MO ENTABLERADO',kind:'JOINTING',quantity:'0.5776',quantityUnit:'M2',unitPrice:'200',priceUnit:'SOURCE_MONEY_PER_M2',totalSaved:'115.52'},
        {name:'MO ENSAMBLES',kind:'JOINERY',quantity:'11.36',quantityUnit:'FRACTIONAL_PZA_CONSUMPTION',unitPrice:'10',priceUnit:'SOURCE_MONEY_PER_PZA_CONSUMPTION',totalSaved:'113.6'},
        {name:'MO BARNIZ',kind:'VARNISH_LABOR',quantity:'1.1552',quantityUnit:'M2_FINISH',unitPrice:'180',priceUnit:'SOURCE_MONEY_PER_M2_FINISH',totalSaved:'207.936'},
        {name:'CNC / LASER',kind:'CNC',quantity:'2.23',quantityUnit:'ML',unitPrice:'10',priceUnit:'SOURCE_MONEY_PER_MINUTE',totalSaved:'111.5'}],
      dayLabor:[{name:'MO Carpintería',kind:'LABOR_DAYS',quantity:'0.1',quantityUnit:'DAY',unitPrice:'867.5',priceUnit:'SOURCE_MONEY_PER_DAY',totalSaved:'86.75'},
        ...[['Instalación','1200'],['CNC /Láser','507.5'],['Acabados','697.5'],['Tejido','840'],['Integración','502.5']].map(([name,price])=>({name:'MO '+name,kind:'LABOR_DAYS',quantity:null,quantityUnit:'DAY',unitPrice:price,priceUnit:'SOURCE_MONEY_PER_DAY',totalSaved:'0'}))],
      parameters:{cncMinutesPerMeter:{value:'5',unit:'min/m'}}
    }
  });
  // Bent Legs. Editable inputs are per finished table; source amounts retain their precision.
  const economicRow=(name,kind,quantity,quantityUnit,unitPrice,priceBasis,totalSaved)=>({
    name,kind,quantity,quantityUnit,unitPrice,priceUnit:'SOURCE_MONEY_PER_'+priceBasis,totalSaved
  });
  const bentHardware=[['NIVELADOR ESTRIADO','5','20'],['TUERCA INSERTO','0.5','2']];
  recipes.push({
    id:'SYN-BENT-LEGS-R', description:'Mesa auxiliar redonda de Encino rojo con bajo cubierta de Lisapol y cuatro patas de acero doblado. Diámetro 45 cm y altura 46 cm.',
    finishDescription:'Sayer retardante de flama y acero con pintura electrostática RAL 7021',
    finishedSpecs:{Largo:'45',Ancho:'45',Alto:'46',unit:'cm'},woodWastePercent:'30',
    workshopDefaults:{domino:{quantity:'',lengthCm:'',unions:'3'}},
    wood:[{name:'CUBIERTA',quantityPerProduct:'1',width:'45',length:'45',lengthUnit:'cm',woodKind:'Encino rojo',thickness:'1.5',finishFaces:'2',jointed:'1',cnc:{decision:'yes',length:'142',unit:'cm',repetitions:'1'}}],
    hardware:bentHardware.map(([name,unitPrice])=>({name,specification:name,quantityPerProduct:'4',unit:'PZA',unitPrice})),
    boards:[{name:'Bajo cubierta',quantityPerProduct:'1',width:'45',length:'45',lengthUnit:'cm',substrate:'Lisapol',coating:'',thickness:'12',supplier:'PLACOVE',unitPrice:'868.62',sheetAreaM2:'2.88',wasteRate:'15',detail:{edgeWidthCount:'',edgeLengthCount:'',paintFaces:'',gluedFaces:'',linearCentimeters:'180',laserCount:'1',notes:'El plano menciona 9 mm. Receta seleccionada en 12 mm.'}}],
    metal:[{name:'Bajo cubierta · cuadrado macizo 3/8″',section:'metal-tube',quantity:'1',length:'72',width:'',lengthUnit:'cm',gauge:'',unitPrice:'50',detail:{sideACm:'0.9525',sideBCm:'0.9525',kgPerMl:'0.71',laborPrice:'65',paintPrice:'110'}},
      {name:'Patas · redondo macizo 1/2″',section:'metal-tube',quantity:'4',length:'77',width:'',lengthUnit:'cm',gauge:'',unitPrice:'50',detail:{sideACm:'1.27',sideBCm:'1.27',kgPerMl:'0.99',laborPrice:'65',paintPrice:'110'}}],
    fabrication:{boards:{assemblyRate:'200',cncMinutesPerM:'5',cncRate:'15',integrationDays:'0.5',dayRate:'502.50',extrasPct:'5',extraMaterials:'16.60'},metal:{paintFactor:'1.2',rollingQty:'6',rollingPrice:'90'}},
    observations:[],
    economics:{
      hardware:bentHardware.map(([name,price,amount])=>economicRow(name,'HARDWARE','4','PZA',price,'PZA',amount)),
      wood:[economicRow('CUBIERTA','WOOD','5.19321493188441','P1_WOOD_UNIT_PENDING_DUCO','77','P1_WOOD_UNIT_PENDING_DUCO','399.87754975509955')],
      consumables:[economicRow('ACABADO SAYER RETARDANTE FUEGO','FINISH','0.11571428571428573','L','403','L','46.63285714285715'),
        economicRow('FONDO SAYER RETARDANTE FUEGO','FINISH_PRIMER','0.057857142857142864','L','226','L','13.075714285714287'),
        economicRow('DÓMINOS','DOMINO_CONSUMPTION','5.4','FRACTIONAL_PZA_CONSUMPTION','5','PZA_CONSUMPTION','27'),
        economicRow('PEGAMENTO ENTABLERADO','GLUE','0.1215','L','183','L','22.2345')],
      processes:[economicRow('MO ARMADO','ASSEMBLY','0.2025','M2','200','M2','40.5'),
        economicRow('MO ENTABLERADO','JOINTING','0.2025','M2','300','M2','60.75'),
        economicRow('MO ENSAMBLES','JOINERY','5.4','FRACTIONAL_PZA_CONSUMPTION','20','PZA_CONSUMPTION','108'),
        economicRow('MO BARNIZ','VARNISH_LABOR','0.405','M2_FINISH','180','M2_FINISH','72.9'),
        economicRow('CNC / LÁSER','CNC','1.42','ML','10','MINUTE','71')],
      dayLabor:[['Carpintería','0.33','867.5','286.275'],['Instalación',null,'1200','0'],['CNC / Láser',null,'507.5','0'],['Acabados',null,'697.5','0'],['Tejido',null,'840','0'],['Integración',null,'502.5','0']].map(([name,quantity,price,total])=>economicRow('MO '+name,'LABOR_DAYS',quantity,'DAY',price,'DAY',total)),
      parameters:{cncMinutesPerMeter:{value:'5',unit:'min/m'}}
    }
  });
  function recipe(id) { return recipes.find(value => value.id === id) || null; }
  globalThis.DemoRecipeReference = freeze({ source: 'LOCAL_REFERENCE_D91', recipes, recipe });
}());
