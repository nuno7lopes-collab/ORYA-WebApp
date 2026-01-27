const { Prisma } = require("@prisma/client");
const modelNames = Prisma?.dmmf?.datamodel?.models?.map((m) => m.name) ?? [];
console.log(modelNames.sort());
