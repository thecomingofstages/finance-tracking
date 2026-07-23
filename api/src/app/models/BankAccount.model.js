const { Model, DataTypes } = require("sequelize");

class BankAccount extends Model {
  static initModel(sequelize) {
    BankAccount.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        name: { type: DataTypes.TEXT, allowNull: false },
        // Globally UNIQUE in the shipped schema, not scoped per staff/provider — doc 02 §6
        // gap #7. Two different people at two different banks can't share a number as shipped.
        number: { type: DataTypes.STRING(12), allowNull: false, unique: true },
        provider: { type: DataTypes.TEXT, allowNull: false },
        staff_id: { type: DataTypes.UUID, allowNull: false },
      },
      {
        sequelize,
        modelName: "BankAccount",
        tableName: "bankaccount",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: false, // no such column — never updated in place, only soft-deleted
      }
    );
    return BankAccount;
  }

  static associate({ Staff, Reimbursement }) {
    BankAccount.belongsTo(Staff, { foreignKey: "staff_id", as: "staff" });
    BankAccount.hasMany(Reimbursement, { foreignKey: "banking_id", as: "reimbursements" });
  }

  /** {number} masked to the last 4 digits — full digits only for the owner/finance/owner role. */
  get maskedNumber() {
    const n = this.number || "";
    return n.length > 4 ? `${"x".repeat(n.length - 4)}${n.slice(-4)}` : n;
  }
}

module.exports = BankAccount;
