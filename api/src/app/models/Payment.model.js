const { Model, DataTypes } = require("sequelize");

class Payment extends Model {
  static initModel(sequelize) {
    Payment.init(
      {
        // Has a server-side default, but POST /payments must always pass its own _id
        // explicitly (the external registration_id/purchase_id) — see doc 03 §8.
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        user_id: DataTypes.UUID, // external, nullable, no FK
        source_id: { type: DataTypes.UUID, allowNull: false },
        expected_amount: { type: DataTypes.INTEGER, defaultValue: 0 },
        // No unique constraint yet — doc 02 §6 gap #5. Payment.helper.js must check for an
        // existing live row with the same value before insert until the index exists.
        promptpay_qr_data: DataTypes.TEXT,
      },
      {
        sequelize,
        modelName: "Payment",
        tableName: "payment",
        underscored: true,
        paranoid: true,
        deletedAt: "deleted_at",
        createdAt: "created_at",
        updatedAt: false, // no such column — status changes go through PaymentStatus, not this row
      }
    );
    return Payment;
  }

  static associate({ Source, PaymentStatus }) {
    Payment.belongsTo(Source, { foreignKey: "source_id", as: "source" });
    Payment.hasMany(PaymentStatus, { foreignKey: "payment_id", as: "history" });
  }
}

module.exports = Payment;
