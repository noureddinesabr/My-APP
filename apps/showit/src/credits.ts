/**
 * Where the vehicle photos come from (round 9, #98): real photos with free licences from Wikimedia
 * Commons, their backgrounds removed (that cut-out is shared under the same licence). Shown in
 * Settings › Photo credits, as the licences ask.
 */
export type PhotoCredit = { vehicle: string; title: string; author: string; license: string; url: string };
export const PHOTO_CREDITS: PhotoCredit[] = [
  { vehicle: "triporteur", title: "Motocarro", author: "a_marga", license: "CC BY-SA 2.0", url: "https://www.flickr.com/photos/48741202@N00/2955811066" },
  { vehicle: "smallVan", title: "Renault Kangoo Be Bop", author: "crash71100", license: "CC0 1.0", url: "https://www.flickr.com/photos/152930510@N02/32993897548" },
  { vehicle: "cityTruck", title: "Hyundai H100 Porter 2002", author: "RL GNZLZ", license: "CC BY-SA 2.0", url: "https://www.flickr.com/photos/37691369@N08/11181534883" },
  { vehicle: "pickup", title: "Toyota Hilux TRD 2017", author: "Miles Toyota", license: "CC BY 2.0", url: "https://www.flickr.com/photos/99518655@N08/32810830254" },
  { vehicle: "largeVan", title: "Ford Transit", author: "JLaw45", license: "CC BY 2.0", url: "https://www.flickr.com/photos/27665395@N05/26113417152" },
  { vehicle: "truck35", title: "1976 Mitsubishi Canter", author: "NZ Car Freak", license: "CC BY 2.0", url: "https://www.flickr.com/photos/64583732@N04/6914979489" },
  { vehicle: "lightTruck", title: "Dongfeng DF 1016 2014", author: "RL GNZLZ", license: "CC BY-SA 2.0", url: "https://www.flickr.com/photos/37691369@N08/14252355062" },
  { vehicle: "truck7", title: "Chevy FRR", author: "JLaw45", license: "CC BY 2.0", url: "https://www.flickr.com/photos/27665395@N05/53595051784" },
  { vehicle: "truck12", title: "Mercedes Benz Axor 1835 (3)", author: "Asylumkid", license: "CC BY-SA 2.0", url: "https://www.flickr.com/photos/46185203@N05/11814797434" },
  { vehicle: "refrigerated", title: "2018 Peterbilt Model 220 Reefer Truck", author: "aldenjewell", license: "CC BY 2.0", url: "https://www.flickr.com/photos/31411679@N08/50420154426" },
  { vehicle: "flatbed", title: "DW88079 (18.04.04, Motorvej 501, Viby J)DSC_4501_Balancer", author: "Lav Ulv", license: "CC BY 2.0", url: "https://www.flickr.com/photos/99460566@N06/42918976775" },
  { vehicle: "semi", title: "BE49319 (18.04.06, Motorvej 501, Viby J)DSC_5064_Balancer", author: "Lav Ulv", license: "CC BY 2.0", url: "https://www.flickr.com/photos/99460566@N06/44381941291" },
];
