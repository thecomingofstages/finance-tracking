const { Model, DataTypes } = require("sequelize");
const { REIMBURSEMENT_STATUSES } = require("../utils/enums.util");

/** Maps to reimbursement_updatestatus — append-only log, never updated or deleted. */
class ReimbursementStatus extends Model {
  static initModel(sequelize) {
    ReimbursementStatus.init(
      {
        _id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sequelize.literal("uuid_generate_v7()"),
        },
        reimbursement_id: { type: DataTypes.UUID, allowNull: false },
        status: { type: DataTypes.ENUM(...REIMBURSEMENT_STATUSES), allowNull: false }, // no default — always explicit
        staff_id: { type: DataTypes.UUID, allowNull: false },
      },
      {
        sequelize,
        modelName: "ReimbursementStatus",
        tableName: "reimbursement_updatestatus",
        underscored: true,
        paranoid: false,
        createdAt: "created_at",
        updatedAt: false,
      }
    );
    return ReimbursementStatus;
  }

  static associate({ Reimbursement, Staff }) {
    ReimbursementStatus.belongsTo(Reimbursement, { foreignKey: "reimbursement_id", as: "reimbursement" });
    ReimbursementStatus.belongsTo(Staff, { foreignKey: "staff_id", as: "staff" });
  }
}

module.exports = ReimbursementStatus;
