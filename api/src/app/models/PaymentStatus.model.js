const { Model, DataTypes } = require("sequelize");
const { PAYMENT_STATUSES } = require("../utils/enums.util");

/** Maps to payment_updatestatus — append-only log, never updated or deleted. */
class PaymentStatus extends Model {
  static initModel(sequelize) {
    PaymentStatus.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        payment_id: { type: DataTypes.UUID, allowNull: false },
        status: { type: DataTypes.ENUM(...PAYMENT_STATUSES), defaultValue: "waiting" },
        actual_amount: DataTypes.INTEGER,
        staff_id: { type: DataTypes.UUID, allowNull: false },
      },
      {
        sequelize,
        modelName: "PaymentStatus",
        tableName: "payment_updatestatus",
        underscored: true,
        paranoid: false, // no deleted_at — rows are never removed
        createdAt: "created_at",
        updatedAt: false, // no updated_at — rows are never mutated
      }
    );
    return PaymentStatus;
  }

  static associate({ Payment, Staff }) {
    PaymentStatus.belongsTo(Payment, { foreignKey: "payment_id", as: "payment" });
    PaymentStatus.belongsTo(Staff, { foreignKey: "staff_id", as: "staff" });
  }
}

module.exports = PaymentStatus;
