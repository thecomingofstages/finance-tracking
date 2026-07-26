const { Model, DataTypes } = require("sequelize");
const { PAYMENT_STATUSES } = require("../utils/enums.util");

/** Maps to payment_updatestatus — append-only log, never updated or deleted. */
class PaymentStatus extends Model {
  static initModel(sequelize, schema) {
    PaymentStatus.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          field: "_id",
          defaultValue: sequelize.literal(`${schema}.uuid_generate_v7()`),
        },
        payment_id: { type: DataTypes.UUID, allowNull: false },
        status: { type: DataTypes.ENUM(...PAYMENT_STATUSES), defaultValue: "waiting" },
        actual_amount: DataTypes.INTEGER,
        staff_id: { type: DataTypes.UUID, allowNull: false },
      },
      {
        sequelize,
        schema,
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
