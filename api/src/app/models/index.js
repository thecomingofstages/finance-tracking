const sequelize = require("../database/Postgres.database");

const modelClasses = [
  require("./Project.model"),
  require("./ProjectTag.model"),
  require("./Department.model"),
  require("./Staff.model"),
  require("./BankAccount.model"),
  require("./StaffDept.model"),
  require("./Source.model"),
  require("./Payment.model"),
  require("./PaymentStatus.model"),
  require("./Reimbursement.model"),
  require("./ReimbursementDetail.model"),
  require("./ReimbursementStatus.model"),
];

const registry = {};
for (const ModelClass of modelClasses) {
  ModelClass.initModel(sequelize);
  registry[ModelClass.name] = ModelClass;
}
for (const ModelClass of modelClasses) {
  if (typeof ModelClass.associate === "function") ModelClass.associate(registry);
}

module.exports = { sequelize, ...registry };
